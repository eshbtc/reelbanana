
const express = require('express');
const cors = require('cors');
const { Storage } = require('@google-cloud/storage');
const { createHash } = require('crypto');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs/promises');
const path = require('path');
const admin = require('firebase-admin');
const { createExpensiveOperationLimiter } = require('./shared/rateLimiter');
const { createHealthEndpoints, commonDependencyChecks } = require('./shared/healthCheck');
const { createSLIMiddleware, SLIMonitor } = require('./shared/sliMonitor');

const app = express();

// Trust proxy for Cloud Run (fixes X-Forwarded-For header issue for IP rate limiting)
app.set('trust proxy', true);

app.use(express.json());
app.use(cors());

// SLI monitoring middleware
app.use(createSLIMiddleware('render'));

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

// Observability & Error helpers
const { randomUUID } = require('crypto');
app.use((req, res, next) => {
  req.requestId = randomUUID();
  req.startTime = Date.now();
  res.setHeader('X-Request-Id', req.requestId);
  next();
});
app.use((req, res, next) => {
  res.on('finish', () => {
    const durationMs = Date.now() - (req.startTime || Date.now());
    const log = {
      severity: res.statusCode >= 500 ? 'ERROR' : 'INFO',
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      status: res.statusCode,
      durationMs,
      appId: req.appCheckClaims?.app_id || req.appCheckClaims?.appId || undefined,
    };
    try { console.log(JSON.stringify(log)); } catch (_) { console.log(log); }
  });
  next();
});
function sendError(req, res, httpStatus, code, message, details) {
  const payload = { code, message };
  if (details) payload.details = details;
  payload.requestId = req.requestId || res.getHeader('X-Request-Id');
  res.status(httpStatus).json(payload);
}

// App Check verification middleware
const appCheckVerification = async (req, res, next) => {
  const appCheckToken = req.header('X-Firebase-AppCheck');

  if (!appCheckToken) {
    return sendError(req, res, 401, 'APP_CHECK_REQUIRED', 'App Check token required');
  }

  try {
    const appCheckClaims = await admin.appCheck().verifyToken(appCheckToken);
    req.appCheckClaims = appCheckClaims;
    return next();
  } catch (err) {
    console.error('App Check verification failed:', err);
    return sendError(req, res, 401, 'APP_CHECK_INVALID', 'Invalid App Check token');
  }
};

const storage = new Storage();
const inputBucketName = process.env.INPUT_BUCKET_NAME || 'reel-banana-35a54.firebasestorage.app';
const outputBucketName = process.env.OUTPUT_BUCKET_NAME || 'reel-banana-35a54.firebasestorage.app';
const renderEngineEnv = (process.env.RENDER_ENGINE || '').toLowerCase();
const falApiKey = process.env.FAL_RENDER_API_KEY || process.env.FAL_API_KEY || process.env.FAL_KEY || null;
const falRenderModel = process.env.FAL_RENDER_MODEL || '';
// Cache metrics
const cacheMetrics = { hits: 0, writes: 0 };

// Retry utility with exponential backoff
async function retryWithBackoff(operation, maxRetries = null, baseDelay = null) {
  const retries = maxRetries || parseInt(process.env.RETRY_MAX || '3', 10);
  const delay = baseDelay || parseInt(process.env.RETRY_BASE_DELAY_MS || '1000', 10);
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }
      
      const backoffDelay = delay * Math.pow(2, attempt - 1);
      console.log(`Attempt ${attempt} failed, retrying in ${backoffDelay}ms:`, error.message);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }
}

/**
 * POST /render
 * Orchestrates the entire video rendering process.
 *
 * Request Body:
 * {
 *   "projectId": "string",
 *   "scenes": [ { "narration": "string", "imageCount": number } ],
 *   "gsAudioPath": "gs://...",
 *   "srtPath": "gs://..."
 * }
 * Response:
 * {
 *   "videoUrl": "https://storage.googleapis.com/..."
 * }
 */
app.post('/render', ...createExpensiveOperationLimiter('render'), appCheckVerification, async (req, res) => {
    const renderStartTime = Date.now();
    const { projectId, scenes, gsAudioPath, srtPath, gsMusicPath, useFal } = req.body;

    if (!projectId) {
        return sendError(req, res, 400, 'INVALID_ARGUMENT', 'Missing required field: projectId');
    }

    console.log(`Received render request for projectId: ${projectId}`);
    
    // Declare tempDir outside try block so it's accessible in finally
    let tempDir;
    console.log('🔧 Render service: tempDir scope fix applied');
    
    try {
        // Check if we should use FAL rendering engine
        // Request body overrides env so the client can force FFmpeg fallback
        const useFalEngine = (typeof useFal === 'boolean') ? !!useFal : (renderEngineEnv === 'fal');
        console.log(`Render engine selected: ${useFalEngine ? 'FAL' : 'FFmpeg'} (env=${renderEngineEnv}, body.useFal=${useFal})`);
        if (useFalEngine) {
            if (!falApiKey) {
                return sendError(req, res, 500, 'CONFIG', 'FAL_API_KEY is not configured');
            }
            if (!falRenderModel) {
                return sendError(req, res, 500, 'CONFIG', 'FAL_RENDER_MODEL is not configured');
            }

            // Early cache path as usual
            const outputBucket = storage.bucket(outputBucketName);
            const finalVideoFile = outputBucket.file(`${projectId}/movie.mp4`);
            const [exists] = await finalVideoFile.exists();
            if (exists) {
                const isPublishedCached = req.body.published || false;
                let videoUrlCached;
                if (isPublishedCached) {
                    try { await finalVideoFile.makePublic(); } catch (_) {}
                    videoUrlCached = finalVideoFile.publicUrl();
                } else {
                    const [signedUrl] = await finalVideoFile.getSignedUrl({ version: 'v4', action: 'read', expires: Date.now() + 7*24*60*60*1000 });
                    videoUrlCached = signedUrl;
                }
                req.sliMonitor.recordSuccess('render', true, { projectId, cached: true, engine: 'fal' });
                req.sliMonitor.recordLatency('render', Date.now() - renderStartTime, { projectId, cached: true, engine: 'fal' });
                return res.status(200).json({ videoUrl: videoUrlCached, cached: true });
            }

            if (!scenes || !gsAudioPath || !srtPath) {
                return sendError(req, res, 400, 'INVALID_ARGUMENT', 'Missing required fields for rendering.');
            }

            // Determine plan → resolution
            let plan = 'free';
            try {
                const authHeader = req.headers.authorization || '';
                if (authHeader.startsWith('Bearer ')) {
                    const idToken = authHeader.split('Bearer ')[1];
                    const decoded = await admin.auth().verifyIdToken(idToken);
                    const userDoc = await admin.firestore().collection('users').doc(decoded.uid).get();
                    if (userDoc.exists) plan = String(userDoc.data().plan || 'free').toLowerCase();
                }
            } catch (e) { console.warn('Render plan lookup failed; defaulting to free'); }
            const PLAN_RES = { free: { w: 854, h: 480 }, plus: { w: 1280, h: 720 }, pro: { w: 1920, h: 1080 }, studio: { w: 3840, h: 2160 } };
            const { w: targetW, h: targetH } = PLAN_RES[plan] || PLAN_RES.free;

            // Helper: parse gs://bucket/path → { bucket, path }
            const parseGs = (gs) => {
                if (!gs || !gs.startsWith('gs://')) return null;
                const rest = gs.substring('gs://'.length);
                const firstSlash = rest.indexOf('/');
                if (firstSlash < 0) return null;
                return { bucket: rest.substring(0, firstSlash), path: rest.substring(firstSlash + 1) };
            };
            const signReadUrl = async ({ bucket, path }) => {
                const file = storage.bucket(bucket).file(path);
                const [url] = await file.getSignedUrl({ version: 'v4', action: 'read', expires: Date.now() + 60 * 60 * 1000 });
                return url;
            };

            // List images and pick first for each scene index
            const inputBucket = storage.bucket(inputBucketName);
            const imageFiles = (await inputBucket.getFiles({ prefix: `${projectId}/scene-` }))[0];
            const pickFirstForIndex = (idx) => {
                const match = imageFiles.find(f => path.basename(f.name).startsWith(`scene-${idx}-`));
                return match || null;
            };

            const imageUrls = [];
            for (let i = 0; i < scenes.length; i++) {
                const file = pickFirstForIndex(i);
                if (!file) {
                    console.warn(`FAL render: no image for scene ${i}`);
                    continue;
                }
                const signed = await inputBucket.file(file.name).getSignedUrl({ version: 'v4', action: 'read', expires: Date.now() + 60*60*1000 });
                imageUrls.push({ url: signed[0], duration: scenes[i].duration || 3, camera: scenes[i].camera || 'static', transition: scenes[i].transition || 'fade' });
            }

            const audioObj = parseGs(gsAudioPath);
            const srtObj = parseGs(srtPath);
            const musicObj = gsMusicPath ? parseGs(gsMusicPath) : null;
            const audioUrl = audioObj ? await signReadUrl(audioObj) : null;
            const srtUrl = srtObj ? await signReadUrl(srtObj) : null;
            const musicUrl = musicObj ? await signReadUrl(musicObj) : null;

            // Prepare input for FAL model
            const totalDuration = (scenes || []).reduce((sum, s) => sum + (s?.duration || 3), 0);
            let falInput;
            if (falRenderModel.includes('veo3/fast/image-to-video') || falRenderModel.includes('image-to-video')) {
                // Veo 3 Fast Image-to-Video expects a single image_url and a prompt
                const inputBucket = storage.bucket(inputBucketName);
                const imageFiles = (await inputBucket.getFiles({ prefix: `${projectId}/scene-` }))[0];
                const first = imageFiles.find(f => /scene-0-/.test(path.basename(f.name))) || imageFiles[0];
                if (!first) {
                    return sendError(req, res, 400, 'INVALID_ARGUMENT', 'No scene images found for Veo image-to-video');
                }
                const [signedUrl] = await inputBucket.file(first.name).getSignedUrl({ version: 'v4', action: 'read', expires: Date.now() + 60*60*1000 });
                falInput = {
                    prompt: req.body.veoPrompt || `Create a short cinematic video for: ${String((req.body && req.body.prompt) || '').slice(0,200) || 'story'}`,
                    image_url: signedUrl
                };
            } else if (falRenderModel.includes('veo3/fast') || falRenderModel.includes('veo')) {
                // Veo 3 Fast text-to-video expects just a prompt
                falInput = {
                    prompt: req.body.veoPrompt || 'A cinematic short illustrating the provided narration in two short scenes.'
                };
            } else {
                // Generic compose input (images + audio)
                falInput = {
                    images: imageUrls,
                    narrationUrl: audioUrl,
                    musicUrl: musicUrl,
                    captionsUrl: srtUrl,
                    resolution: { width: targetW, height: targetH },
                    published: !!req.body.published
                };
            }
            
            // Before calling FAL: global cache by manifest (fal engine)
            const falManifest = {
              v: 1,
              engine: 'fal',
              model: falRenderModel,
              prompt: req.body.veoPrompt || null,
              plan,
              size: { width: targetW, height: targetH },
              inputs: {
                images: await Promise.all(imageUrls.map(async (it, idx) => {
                  const f = pickFirstForIndex(idx);
                  if (!f) return '';
                  try { const [m] = await inputBucket.file(f.name).getMetadata(); return m.md5Hash || ''; } catch { return ''; }
                })),
                audio: audioObj ? (await (async()=>{ try { const [m]=await storage.bucket(audioObj.bucket).file(audioObj.path).getMetadata(); return m.md5Hash||'';} catch {return '';} })()) : '',
                music: musicObj ? (await (async()=>{ try { const [m]=await storage.bucket(musicObj.bucket).file(musicObj.path).getMetadata(); return m.md5Hash||'';} catch {return '';} })()) : '',
                captions: srtObj ? (await (async()=>{ try { const [m]=await storage.bucket(srtObj.bucket).file(srtObj.path).getMetadata(); return m.md5Hash||'';} catch {return '';} })()) : ''
              }
            };
            const falManifestHash = createHash('sha256').update(JSON.stringify(falManifest)).digest('hex');
            const falCacheFile = outputBucket.file(`cache/render/${falManifestHash}.mp4`);
            const [falCacheExists] = await falCacheFile.exists();
            if (falCacheExists) {
              await falCacheFile.copy(finalVideoFile);
              const isPub = req.body.published || false;
              let url;
              if (isPub) { try { await finalVideoFile.makePublic(); } catch(_){} url = finalVideoFile.publicUrl(); }
              else { const [u] = await finalVideoFile.getSignedUrl({ version:'v4', action:'read', expires: Date.now()+7*24*60*60*1000 }); url = u; }
              req.sliMonitor.recordSuccess('render', true, { projectId, cached: true, engine: 'fal', cacheId: falManifestHash });
              req.sliMonitor.recordLatency('render', Date.now() - renderStartTime, { projectId, cached: true, engine: 'fal' });
              return res.status(200).json({ videoUrl: url, cached: true, engine: 'fal' });
            }

            // Call FAL (queue API for long-running models like Veo 3 Fast)
            const { fal } = await import('@fal-ai/client');
            fal.config({ credentials: falApiKey });
            let outputUrl = null;
            try {
                const pickUrl = (j) => j?.output_url || j?.result?.url || j?.data?.url || j?.output?.url || j?.video?.url || null;
                if (falRenderModel.includes('fal-ai/veo3/fast')) {
                    const submit = await fal.queue.submit(falRenderModel, { input: falInput, logs: false });
                    const requestId = submit?.request_id || submit?.requestId;
                    if (!requestId) throw new Error('Missing FAL request id');
                    const timeoutMs = parseInt(process.env.FAL_RENDER_TIMEOUT_MS || '600000', 10); // 10 minutes
                    const pollMs = parseInt(process.env.FAL_RENDER_POLL_MS || '3000', 10);
                    const start = Date.now();
                    while (Date.now() - start < timeoutMs) {
                        const st = await fal.queue.status(falRenderModel, { requestId, logs: false });
                        const s = (st?.status || '').toString().toUpperCase();
                        if (s === 'COMPLETED') break;
                        if (s === 'FAILED' || s === 'ERROR') throw new Error(`FAL status ${s}`);
                        await new Promise(r => setTimeout(r, pollMs));
                    }
                    const result = await fal.queue.result(falRenderModel, { requestId });
                    outputUrl = pickUrl(result?.data);
                } else {
                    // Subscribe path for simpler/fast models
                    const result = await fal.subscribe(falRenderModel, { input: falInput, logs: false });
                    outputUrl = pickUrl(result?.data);
                }
                if (!outputUrl) {
                    return sendError(req, res, 500, 'FAL_RENDER_FAILURE', 'FAL did not return a video URL');
                }
            } catch (e) {
                console.error('FAL render error:', e?.message || e);
                return sendError(req, res, 500, 'FAL_RENDER_FAILURE', 'FAL rendering failed', e?.message || String(e));
            }

            // Persist output to GCS and return final URL
            const file = outputBucket.file(`${projectId}/movie.mp4`);
            const remoteRes = await fetch(outputUrl);
            if (!remoteRes.ok) {
                return sendError(req, res, 500, 'FAL_DOWNLOAD_FAILED', `Failed to download FAL output: ${remoteRes.status}`);
            }
            const arrayBuffer = await remoteRes.arrayBuffer();
            await file.save(Buffer.from(arrayBuffer), { metadata: { contentType: 'video/mp4' } });

            // Save to global cache
            try {
              await file.copy(falCacheFile);
              console.log(`Saved FAL render to cache key ${falManifestHash}`);
            } catch (e) {
              console.warn('FAL render cache write failed:', e.message);
            }

            let videoUrl;
            const isPublished = req.body.published || false;
            if (isPublished) {
                try { await file.makePublic(); } catch (_) {}
                videoUrl = file.publicUrl();
            } else {
                const [signedUrl] = await file.getSignedUrl({ version: 'v4', action: 'read', expires: Date.now() + 7*24*60*60*1000 });
                videoUrl = signedUrl;
            }

            req.sliMonitor.recordSuccess('render', true, { projectId, cached: false, engine: 'fal' });
            req.sliMonitor.recordLatency('render', Date.now() - renderStartTime, { projectId, cached: false, engine: 'fal' });
            return res.status(200).json({ videoUrl, engine: 'fal' });
        }
        // Early path: if a final video already exists, allow "publish-only" requests
        // This supports calling /render with just { projectId, published: true }
        const outputBucket = storage.bucket(outputBucketName);
        const finalVideoFile = outputBucket.file(`${projectId}/movie.mp4`);
        const [exists] = await finalVideoFile.exists();
        if (exists) {
            console.log(`Final video already exists for ${projectId}, evaluating URL type (published vs draft)`);

            const isPublished = req.body.published || false;
            let videoUrl;

            if (isPublished) {
                try {
                    await finalVideoFile.makePublic();
                } catch (_) {}
                videoUrl = finalVideoFile.publicUrl();
                console.log(`Returning durable public URL for published video: ${videoUrl}`);
            } else {
                const [signedUrl] = await finalVideoFile.getSignedUrl({
                    version: 'v4',
                    action: 'read',
                    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
                });
                videoUrl = signedUrl;
                console.log(`Returning 7-day signed URL for draft video`);
            }

            // Record successful cached render SLI
            const renderDuration = Date.now() - renderStartTime;
            req.sliMonitor.recordSuccess('render', true, { projectId, cached: true });
            req.sliMonitor.recordLatency('render', renderDuration, { projectId, cached: true });
            cacheMetrics.hits++;
            
            return res.status(200).json({ videoUrl, cached: true });
        }

        // Validate required fields for a fresh render only if no cached video exists
        if (!scenes || !gsAudioPath || !srtPath) {
            return sendError(req, res, 400, 'INVALID_ARGUMENT', 'Missing required fields for rendering.');
        }
        
        tempDir = path.join('/tmp', projectId);
        // Determine plan (optional gating)
        let plan = 'free';
        try {
            const authHeader = req.headers.authorization || '';
            if (authHeader.startsWith('Bearer ')) {
                const idToken = authHeader.split('Bearer ')[1];
                const decoded = await admin.auth().verifyIdToken(idToken);
                const userDoc = await admin.firestore().collection('users').doc(decoded.uid).get();
                if (userDoc.exists) plan = String(userDoc.data().plan || 'free').toLowerCase();
            }
        } catch (e) {
            console.warn('Render plan lookup failed; defaulting to free');
        }
        const PLAN_RES = { free: { w: 854, h: 480 }, plus: { w: 1280, h: 720 }, pro: { w: 1920, h: 1080 }, studio: { w: 3840, h: 2160 } };
        const { w: targetW, h: targetH } = PLAN_RES[plan] || PLAN_RES.free;

        // Compute global render cache key (manifest)
        const inputBucket = storage.bucket(inputBucketName);
        const listImages = (await inputBucket.getFiles({ prefix: `${projectId}/scene-` }))[0];
        const pickFirstForIndex = (idx) => listImages.find(f => path.basename(f.name).startsWith(`scene-${idx}-`));
        const usedImages = scenes.map((_, i) => pickFirstForIndex(i)).filter(Boolean);
        const getMd5 = async (file) => { try { const [m] = await file.getMetadata(); return m.md5Hash || ''; } catch { return ''; } };
        const imgMd5s = await Promise.all(usedImages.map(f => getMd5(f)));

        // Resolve audio/music/captions remote paths like later code does
        let remoteAudio = `${projectId}/narration.mp3`;
        const prefixAudio = `gs://${inputBucketName}/`;
        if (gsAudioPath?.startsWith(prefixAudio)) {
            const rel = gsAudioPath.substring(prefixAudio.length);
            if (rel && rel.includes(projectId + '/')) remoteAudio = rel;
        }
        const audioMd5 = await getMd5(inputBucket.file(remoteAudio));
        const captionsMd5 = await getMd5(inputBucket.file(`${projectId}/captions.srt`));
        let musicRel = null, musicMd5 = '';
        if (gsMusicPath) {
            const prefixMusic = `gs://${inputBucketName}/`;
            if (gsMusicPath.startsWith(prefixMusic)) {
                const rel = gsMusicPath.substring(prefixMusic.length);
                if (rel && rel.includes(projectId + '/')) musicRel = rel; else musicRel = `${projectId}/music.wav`;
            } else {
                musicRel = `${projectId}/music.wav`;
            }
            musicMd5 = await getMd5(inputBucket.file(musicRel));
        }

        const planRes = { free: { w: 854, h: 480 }, plus: { w: 1280, h: 720 }, pro: { w: 1920, h: 1080 }, studio: { w: 3840, h: 2160 } };
        // reuse plan from above if resolved later; compute simple signature with target size fallback
        let manifestPlan = 'free';
        try {
            const authHeader = req.headers.authorization || '';
            if (authHeader.startsWith('Bearer ')) {
                const idToken = authHeader.split('Bearer ')[1];
                const decoded = await admin.auth().verifyIdToken(idToken);
                const userDoc = await admin.firestore().collection('users').doc(decoded.uid).get();
                if (userDoc.exists) manifestPlan = String(userDoc.data().plan || 'free').toLowerCase();
            }
        } catch {}
        const planSize = planRes[manifestPlan] || planRes.free;
        const manifest = {
            v: 1,
            engine: 'ffmpeg',
            plan: manifestPlan,
            size: planSize,
            scenes: (scenes || []).map(s => ({ d: s?.duration || 3, c: s?.camera || 'static', t: s?.transition || 'fade' })),
            inputs: { img: imgMd5s, audio: audioMd5, music: musicMd5, captions: captionsMd5 }
        };
        const manifestHash = createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
        const cacheFile = outputBucket.file(`cache/render/${manifestHash}.mp4`);
        const [cacheExists] = await cacheFile.exists();
        if (cacheExists) {
            await cacheFile.copy(finalVideoFile);
            const isPublishedCached = req.body.published || false;
            let videoUrlCached;
            if (isPublishedCached) {
                try { await finalVideoFile.makePublic(); } catch (_) {}
                videoUrlCached = finalVideoFile.publicUrl();
            } else {
                const [signedUrl] = await finalVideoFile.getSignedUrl({ version: 'v4', action: 'read', expires: Date.now() + 7*24*60*60*1000 });
                videoUrlCached = signedUrl;
            }
            req.sliMonitor.recordSuccess('render', true, { projectId, cached: true, engine: 'ffmpeg', cacheId: manifestHash });
            req.sliMonitor.recordLatency('render', Date.now() - renderStartTime, { projectId, cached: true, engine: 'ffmpeg' });
            cacheMetrics.hits++;
            return res.status(200).json({ videoUrl: videoUrlCached, cached: true });
        }

        // 1. Setup: Create a temporary local directory for processing
        await fs.mkdir(tempDir, { recursive: true });

        // 2. Download all necessary assets from GCS
        console.log('Downloading assets...');
        const imageFiles = (await inputBucket.getFiles({ prefix: `${projectId}/scene-` }))[0];
        
        console.log(`Found ${imageFiles.length} image files:`, imageFiles.map(f => f.name));
        
        // Debug: Also check for any files in the project directory
        const allProjectFiles = (await inputBucket.getFiles({ prefix: `${projectId}/` }))[0];
        console.log(`All project files (${allProjectFiles.length}):`, allProjectFiles.map(f => f.name));
        
        // Resolve the correct remote audio and music filenames
        let musicLocalPath = null;
        let narrationLocalPath = path.join(tempDir, 'narration.mp3');
        
        // Use the remoteAudio path already resolved above
        
        const downloadPromises = [
            ...imageFiles.map(file => file.download({ destination: path.join(tempDir, path.basename(file.name)) })),
            inputBucket.file(remoteAudio).download({ destination: narrationLocalPath }),
            inputBucket.file(`${projectId}/captions.srt`).download({ destination: path.join(tempDir, 'captions.srt') }),
        ];
        
        if (gsMusicPath) {
            try {
                const prefix = `gs://${inputBucketName}/`;
                let remoteMusic = `${projectId}/music.wav`; // Default to WAV now
                if (gsMusicPath.startsWith(prefix)) {
                    const rel = gsMusicPath.substring(prefix.length);
                    if (rel && rel.includes(projectId + '/')) {
                        remoteMusic = rel;
                    }
                }
                const ext = path.extname(remoteMusic) || '.wav';
                const localName = `music${ext}`;
                musicLocalPath = path.join(tempDir, localName);
                downloadPromises.push(inputBucket.file(remoteMusic).download({ destination: musicLocalPath }));
            } catch (_) {
                // Fallback: try both WAV and MP3
                try {
                    musicLocalPath = path.join(tempDir, 'music.wav');
                    downloadPromises.push(inputBucket.file(`${projectId}/music.wav`).download({ destination: musicLocalPath }));
                } catch (__) {
                    musicLocalPath = path.join(tempDir, 'music.mp3');
                    downloadPromises.push(inputBucket.file(`${projectId}/music.mp3`).download({ destination: musicLocalPath }));
                }
            }
        }
        
        await Promise.all(downloadPromises);
        console.log('Asset download complete.');

        // 3. FFmpeg processing
        console.log('Starting FFmpeg processing...');
        const command = ffmpeg();
        const complexFilter = [];
        let sceneOutputs = [];

        // For each scene, create a short video clip from its image sequence
        scenes.forEach((scene, sceneIndex) => {
            // Find the actual image files for this scene
            const sceneImages = imageFiles.filter(file => {
                const fileName = path.basename(file.name);
                const matches = fileName.startsWith(`scene-${sceneIndex}-`);
                console.log(`Scene ${sceneIndex}: Checking file ${fileName}, matches: ${matches}`);
                return matches;
            });
            
            console.log(`Scene ${sceneIndex}: Found ${sceneImages.length} images:`, sceneImages.map(f => path.basename(f.name)));
            
            if (sceneImages.length === 0) {
                console.error(`No images found for scene ${sceneIndex}`);
                return;
            }
            
            // Use the first image for the scene (or we could create a sequence)
            const firstImage = sceneImages[0];
            const localImagePath = path.join(tempDir, path.basename(firstImage.name));
            const duration = scene.duration || 3;
            
            console.log(`Processing scene ${sceneIndex} with image: ${localImagePath}`);
            
            command.input(localImagePath)
                .inputOptions(['-loop 1']) // Loop the single image
                .inputOptions([`-t ${duration}`]); // Duration in seconds

            // Dynamic camera movement based on user selection
            let zoomEffect;
            switch (scene.camera || 'static') {
                case 'zoom-in':
                    zoomEffect = `zoompan=z='min(zoom+0.001,1.3)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${targetW}x${targetH}`;
                    break;
                case 'zoom-out':
                    zoomEffect = `zoompan=z='if(lte(zoom,1.0),1.3,max(1.001,zoom-0.001))':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${targetW}x${targetH}`;
                    break;
                case 'pan-left':
                    zoomEffect = `zoompan=z='1.1':d=1:x='iw/2-(iw/zoom/2)-50*sin(t)':y='ih/2-(ih/zoom/2)':s=${targetW}x${targetH}`;
                    break;
                case 'pan-right':
                    zoomEffect = `zoompan=z='1.1':d=1:x='iw/2-(iw/zoom/2)+50*sin(t)':y='ih/2-(ih/zoom/2)':s=${targetW}x${targetH}`;
                    break;
                default: // static
                    zoomEffect = `scale=${targetW}:${targetH}`;
                    break;
            }
            
            complexFilter.push(`[${sceneIndex}:v]${zoomEffect},format=yuv420p[v${sceneIndex}]`);
            sceneOutputs.push(`[v${sceneIndex}]`);
        });

        // Chain all scene clips together with dynamic transitions
        let currentStream = sceneOutputs[0];
        let totalDuration = 0;
        
        for (let i = 1; i < sceneOutputs.length; i++) {
            const nextStream = sceneOutputs[i];
            const transitionOutput = `transition_${i}`;
            const currentScene = scenes[i - 1];
            const nextScene = scenes[i];
            const transition = nextScene.transition || 'fade';
            const transitionDuration = 0.75;
            
            // Calculate offset based on actual scene durations
            totalDuration += currentScene.duration || 3;
            const offset = totalDuration - transitionDuration;
            
            if (transition === 'none') {
                // No transition, just concatenate
                complexFilter.push(`${currentStream}${nextStream}concat=n=2:v=1:a=0[${transitionOutput}]`);
            } else {
                // Apply the selected transition
                complexFilter.push(`${currentStream}${nextStream}xfade=transition=${transition}:duration=${transitionDuration}:offset=${offset}[${transitionOutput}]`);
            }
            currentStream = `[${transitionOutput}]`;
        }

        // Add subtitles and define final output
        const finalVideoOutput = '[final_video]';
        let subFilter = `${currentStream}subtitles=${path.join(tempDir, 'captions.srt')}:force_style='Fontsize=18,PrimaryColour=&HFFFFFF&,OutlineColour=&H000000&,BorderStyle=3,Outline=1,Shadow=1,MarginV=25'`;
        if (plan === 'free') {
            subFilter += ",drawtext=text='ReelBanana':fontcolor=white@0.6:fontsize=24:box=1:boxcolor=black@0.4:boxborderw=5:x=w-tw-10:y=h-th-10";
        }
        subFilter += finalVideoOutput;
        complexFilter.push(subFilter);
        
        // Add audio mixing with gentle ducking if music is available
        // Calculate correct audio input indices: images are added first, then audio
        const imageInputs = scenes.length;
        const narrationAudioIndex = imageInputs;
        const musicAudioIndex = imageInputs + 1;

        if (gsMusicPath) {
            // Sidechain compress music with narration as sidechain, then mix
            // 1) Duck music when narration is present
            complexFilter.push(`[${musicAudioIndex}:a][${narrationAudioIndex}:a]sidechaincompress=threshold=0.05:ratio=6:attack=5:release=300[ducked]`);
            // 2) Mix ducked music with narration
            complexFilter.push(`[ducked][${narrationAudioIndex}:a]amix=inputs=2:duration=first:dropout_transition=2,volume=1.0[final_audio]`);
        } else {
            // Just use narration audio
            complexFilter.push(`[${narrationAudioIndex}:a]volume=0.9[final_audio]`);
        }
        
        const outputVideoPath = path.join(tempDir, 'final_movie.mp4');

        await new Promise((resolve, reject) => {
            // Add audio inputs
            command.input(narrationLocalPath); // narration audio track
            
            if (musicLocalPath) {
                command.input(musicLocalPath); // music track
            }
            
            command
                .complexFilter(complexFilter)
                .map(finalVideoOutput) // Map the final video stream
                .map('[final_audio]') // Map the mixed audio stream
                .outputOptions([
                    '-c:v libx264',
                    '-preset slow',
                    '-crf 22',
                    '-c:a aac',
                    '-b:a 192k',
                    '-pix_fmt yuv420p',
                    // Move moov atom to the beginning for progressive playback
                    '-movflags +faststart',
                    '-shortest' // Finish encoding when the shortest input (audio) ends
                ])
                .on('end', () => {
                    console.log('FFmpeg processing finished.');
                    resolve();
                })
                .on('error', (err) => {
                    console.error('FFmpeg error:', err.message);
                    reject(new Error('FFMPEG_FAILURE'));
                })
                .save(outputVideoPath);
        });

        // 4. Upload the final video to the output bucket
        console.log('Uploading final video...');
        // Reuse outputBucket variable from cache check above
        const [uploadedFile] = await retryWithBackoff(async () => {
            return await outputBucket.upload(outputVideoPath, {
                destination: `${projectId}/movie.mp4`,
                metadata: { contentType: 'video/mp4' },
            });
        });
        // Save to global cache for reuse
        try {
            await uploadedFile.copy(cacheFile);
            console.log(`Saved render to cache key ${manifestHash}`);
        } catch (e) {
            console.warn('Render cache write failed:', e.message);
        }

        // For published videos, make the file public for durable URLs
        // For draft videos, use signed URLs with longer expiration
        const isPublished = req.body.published || false;
        
        let videoUrl;
        if (isPublished) {
            // Make file public for published videos (durable URLs)
            await retryWithBackoff(async () => {
                await uploadedFile.makePublic();
            });
            videoUrl = uploadedFile.publicUrl();
            console.log(`Video uploaded and made public for published content`);
        } else {
            // Use signed URL with 7-day expiration for draft videos
            const [signedUrl] = await retryWithBackoff(async () => {
                return await uploadedFile.getSignedUrl({
                    version: 'v4',
                    action: 'read',
                    expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
                });
            });
            videoUrl = signedUrl;
            console.log(`Video uploaded with 7-day signed URL for draft content`);
        }
        
        // Record successful fresh render SLI
        const renderDuration = Date.now() - renderStartTime;
        req.sliMonitor.recordSuccess('render', true, { projectId, cached: false });
        req.sliMonitor.recordLatency('render', renderDuration, { projectId, cached: false });
        
        res.status(200).json({ videoUrl });

    } catch (error) {
        console.error(`Error rendering video for projectId ${projectId}:`, error);
        
        // Record failed render SLI
        const renderDuration = Date.now() - renderStartTime;
        req.sliMonitor.recordSuccess('render', false, { projectId, error: error.message });
        req.sliMonitor.recordLatency('render', renderDuration, { projectId, error: error.message });
        req.sliMonitor.recordError('render', error.name || 'unknown', { projectId });
        
        if (error && error.message === 'FFMPEG_FAILURE') {
          return sendError(req, res, 500, 'FFMPEG_FAILURE', 'FFmpeg failed to render the video.');
        }
        return sendError(req, res, 500, 'INTERNAL', 'Failed to render video.', error.message);
    } finally {
        // 5. Cleanup: Remove the temporary local directory
        if (tempDir) {
            try {
                await fs.rm(tempDir, { recursive: true, force: true });
                console.log(`Cleaned up temporary directory: ${tempDir}`);
            } catch (cleanupError) {
                console.error(`Failed to cleanup temp directory ${tempDir}:`, cleanupError);
            }
        }
    }
});

// FAL API health check function
async function checkFalApiHealth() {
  if (!falApiKey) {
    throw new Error('No FAL API key configured');
  }
  
  try {
    // Test FAL API with a simple request
    const response = await fetch('https://fal.run/fal-ai/fast-sdxl', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: 'test',
        image_size: 'square_hd',
        num_inference_steps: 1,
        enable_safety_checker: false
      })
    });
    
    if (response.ok) {
      return { message: 'FAL API accessible and working' };
    } else {
      throw new Error(`FAL API returned ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    throw new Error(`FAL API health check failed: ${error.message}`);
  }
}

// Lightweight health check (no App Check required)
// Health check endpoints
createHealthEndpoints(app, 'render', 
  {
    inputBucket: inputBucketName,
    outputBucket: outputBucketName,
    falConfigured: !!falApiKey,
    falModel: falRenderModel || 'not-configured',
    engine: renderEngineEnv || 'ffmpeg'
  },
  {
    dependencies: {
      gcs: () => commonDependencyChecks.gcs(inputBucketName),
      firebase: () => commonDependencyChecks.firebase(),
      falApi: () => checkFalApiHealth()
    }
  }
);

// SLI dashboard endpoint
app.get('/sli-dashboard', appCheckVerification, (req, res) => {
  try {
    const monitor = new SLIMonitor('render');
    const dashboard = monitor.getHealthSummary();
    res.json(dashboard);
  } catch (error) {
    console.error('SLI dashboard error:', error);
    res.status(500).json({
      error: 'Failed to generate SLI dashboard',
      message: error.message
    });
  }
});

// Cache status (protected)
app.get('/cache-status', appCheckVerification, (req, res) => {
  res.json({
    service: 'render',
    bucket: { input: inputBucketName, output: outputBucketName },
    engine: renderEngineEnv || 'ffmpeg',
    falModel: falRenderModel || null,
    cache: cacheMetrics,
    now: new Date().toISOString(),
  });
});

// Admin-only (DEV_MODE) cache clear endpoint
app.post('/cache-clear', appCheckVerification, async (req, res) => {
  try {
    if (process.env.DEV_MODE !== 'true') {
      return sendError(req, res, 403, 'FORBIDDEN', 'Cache clear allowed only in DEV_MODE');
    }
    const { projectId, cacheId } = req.body || {};
    const outBucket = storage.bucket(outputBucketName);
    const result = { deleted: [] };
    const safeDelete = async (file) => { try { const [ex] = await file.exists(); if (ex) { await file.delete(); result.deleted.push(file.name); } } catch {} };
    if (projectId) {
      await safeDelete(outBucket.file(`${projectId}/movie.mp4`));
      await safeDelete(outBucket.file(`${projectId}/movie_polished.mp4`));
    }
    if (cacheId) {
      await safeDelete(outBucket.file(`cache/render/${cacheId}.mp4`));
    }
    res.json({ status: 'ok', ...result });
  } catch (e) {
    sendError(req, res, 500, 'INTERNAL', 'Failed to clear cache', e?.message);
  }
});

// Playback tracking endpoint for SLI monitoring
app.post('/playback-tracking', appCheckVerification, (req, res) => {
  try {
    const { projectId, success, error, timestamp, videoType } = req.body;
    
    if (!projectId) {
      return sendError(req, res, 400, 'INVALID_ARGUMENT', 'Missing projectId');
    }
    
    // Record playback success/failure for SLI tracking
    const monitor = new SLIMonitor('render');
    monitor.recordSuccess('playback', success, { 
      projectId, 
      videoType: videoType || 'unknown',
      timestamp: timestamp || new Date().toISOString()
    });
    
    if (!success && error) {
      monitor.recordError('playback', 'playback_failure', { 
        projectId, 
        error,
        videoType: videoType || 'unknown'
      });
    }
    
    res.json({ 
      status: 'tracked',
      projectId,
      success,
      requestId: req.requestId
    });
  } catch (error) {
    console.error('Playback tracking error:', error);
    sendError(req, res, 500, 'INTERNAL', 'Failed to track playback', error.message);
  }
});


const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Render service listening on port ${PORT}`);
});
