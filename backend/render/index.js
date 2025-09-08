
// Render service with Veo3 Fast model support
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
app.use(cors({
  origin: [
    'https://reelbanana.ai',
    'https://reel-banana-35a54.web.app',
    'http://localhost:5173',
    'http://localhost:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Firebase-AppCheck']
}));

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
 * POST /generate-clip
 * Generates a single motion clip for a given scene index using the configured FAL image-to-video model.
 * Body: { projectId: string, sceneIndex: number, veoPrompt?: string, videoSeconds?: number, modelOverride?: string }
 * Saves to: gs://OUTPUT_BUCKET_NAME/{projectId}/clips/scene-{sceneIndex}.mp4
 */
app.post('/generate-clip', appCheckVerification, async (req, res) => {
  try {
    const { projectId, sceneIndex, veoPrompt, videoSeconds, modelOverride } = req.body || {};
    if (!projectId || typeof sceneIndex !== 'number' || sceneIndex < 0) {
      return sendError(req, res, 400, 'INVALID_ARGUMENT', 'Missing projectId or invalid sceneIndex');
    }
    const modelId = (modelOverride && String(modelOverride)) || falRenderModel;
    if (!falApiKey) return sendError(req, res, 500, 'CONFIG', 'FAL_API_KEY is not configured');
    if (!modelId) return sendError(req, res, 500, 'CONFIG', 'FAL_RENDER_MODEL is not configured');

    // Find scene image in input bucket
    const inputBucket = storage.bucket(inputBucketName);
    const [files] = await inputBucket.getFiles({ prefix: `${projectId}/scene-${sceneIndex}-` });
    const first = files && files[0];
    if (!first) return sendError(req, res, 404, 'NOT_FOUND', `No image found for scene ${sceneIndex}`);
    const [signedUrl] = await inputBucket.file(first.name).getSignedUrl({ version: 'v4', action: 'read', expires: Date.now() + 60*60*1000 });

    // Build FAL input
    let input = { prompt: veoPrompt || 'Cinematic parallax over UI; subtle camera motion; modern tech vibe.', image_url: signedUrl };
    const secs = parseInt(String(videoSeconds || process.env.FAL_IMAGE_TO_VIDEO_SECONDS || ''), 10);
    if (!isNaN(secs) && secs > 0) {
      input = { ...input, duration: secs, seconds: secs, video_length: secs };
    }

    // Call FAL using queue; try fallback models if first fails
    const { fal } = await import('@fal-ai/client');
    fal.config({ credentials: falApiKey });
    const candidates = Array.from(new Set([
      modelId,
      falRenderModel || null,
      'fal-ai/veo3/fast/image-to-video',
      'fal-ai/ltxv-13b-098-distilled/image-to-video'
    ].filter(Boolean)));

    let outUrl = null; let lastError = null; let usedModel = null;
    const pickUrl = (j) => j?.output_url || j?.result?.url || j?.data?.url || j?.output?.url || j?.video?.url || null;
    const timeoutMs = parseInt(process.env.FAL_RENDER_TIMEOUT_MS || '600000', 10);
    const pollMs = parseInt(process.env.FAL_RENDER_POLL_MS || '3000', 10);

    for (const mdl of candidates) {
      try {
        const submit = await fal.queue.submit(mdl, { input, logs: false });
        const requestId = submit?.request_id || submit?.requestId;
        if (!requestId) throw new Error('Missing FAL request id');
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
          const st = await fal.queue.status(mdl, { requestId, logs: false });
          const s = (st?.status || '').toString().toUpperCase();
          if (s === 'COMPLETED') break;
          if (s === 'FAILED' || s === 'ERROR') throw new Error(`FAL status ${s}`);
          await new Promise(r => setTimeout(r, pollMs));
        }
        const result = await fal.queue.result(mdl, { requestId });
        outUrl = pickUrl(result?.data);
        usedModel = mdl;
        if (outUrl) break;
      } catch (e) {
        lastError = e;
        console.warn('generate-clip: model failed', mdl, e?.message || e);
      }
    }
    if (!outUrl) return sendError(req, res, 500, 'FAL_RENDER_FAILURE', 'FAL did not return a video URL');

    // Download and persist to clips folder
    const outBucket = storage.bucket(outputBucketName);
    const clipPath = `${projectId}/clips/scene-${sceneIndex}.mp4`;
    const file = outBucket.file(clipPath);
    const remote = await fetch(outUrl);
    if (!remote.ok) return sendError(req, res, 500, 'FAL_DOWNLOAD_FAILED', `HTTP ${remote.status}`);
    const buf = Buffer.from(await remote.arrayBuffer());
    await file.save(buf, { metadata: { contentType: 'video/mp4' } });
    const [signedClipUrl] = await file.getSignedUrl({ version: 'v4', action: 'read', expires: Date.now() + 7*24*60*60*1000 });
    res.json({ ok: true, model: usedModel, clipPath, clipUrl: signedClipUrl });
  } catch (e) {
    console.error('generate-clip error:', e);
    return sendError(req, res, 500, 'INTERNAL', 'Failed to generate clip', e?.message || String(e));
  }
});

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
        // Smart engine selection: Use FAL only for specific use cases, default to FFmpeg for full videos
        // FAL is good for: image-to-video generation, experimental features
        // FFmpeg is better for: complex multi-scene videos with transitions
        const totalDuration = (scenes || []).reduce((sum, s) => sum + (s?.duration || 3), 0);
        const isShortVideo = totalDuration <= 30; // 30 seconds or less (increased for LTX Video)
        const isSingleScene = (scenes || []).length <= 1;
        const isImageToVideo = falRenderModel.includes('image-to-video');
        
        // Use FAL if explicitly requested AND (short video OR single scene OR image-to-video model)
        const useFalEngine = (typeof useFal === 'boolean') ? !!useFal && (isShortVideo || isSingleScene || isImageToVideo) : false;
        console.log(`Render engine selected: ${useFalEngine ? 'FAL' : 'FFmpeg'} (env=${renderEngineEnv}, body.useFal=${useFal}, duration=${totalDuration}s, scenes=${(scenes || []).length})`);
        
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
            if (exists && !req.body.force) {
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
                return res.status(200).json({ videoUrl: videoUrlCached, cached: true, skipPolish: true });
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
                // Allow caller to specify clip duration for image-to-video models
                try {
                  const secs = parseInt(String(req.body.falVideoSeconds || process.env.FAL_IMAGE_TO_VIDEO_SECONDS || ''), 10);
                  if (!isNaN(secs) && secs > 0) {
                    falInput.duration = secs;
                    falInput.seconds = secs;
                    falInput.video_length = secs;
                  }
                } catch (_) {}
                // Raw overrides for forward-compatibility with new models
                if (req.body && typeof req.body.falInput === 'object') {
                  try { falInput = { ...falInput, ...req.body.falInput }; } catch (_) {}
                }
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
              return res.status(200).json({ videoUrl: url, cached: true, engine: 'fal', skipPolish: true });
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

            // FAL videos are uploaded to public bucket for direct GCS URL access
            const videoUrl = file.publicUrl();
            console.log(`FAL video uploaded to public bucket for direct access`);

            req.sliMonitor.recordSuccess('render', true, { projectId, cached: false, engine: 'fal' });
            req.sliMonitor.recordLatency('render', Date.now() - renderStartTime, { projectId, cached: false, engine: 'fal' });
            return res.status(200).json({ videoUrl, engine: 'fal', skipPolish: true });
        }
        // Early path: if a final video already exists, allow "publish-only" requests
        // This supports calling /render with just { projectId, published: true }
        const outputBucket = storage.bucket(outputBucketName);
        const finalVideoFile = outputBucket.file(`${projectId}/movie.mp4`);
            const [exists] = await finalVideoFile.exists();
            if (exists && !req.body.force) {
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
        if (cacheExists && !req.body.force) {
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

        // Optionally auto-generate per-scene motion clips with FAL if missing
        try {
          const wantAutoClips = (req.body && (req.body.autoGenerateClips === true)) || (renderEngineEnv === 'fal');
          const modelForClips = (req.body && (req.body.clipModel || req.body.clipModelOverride)) || falRenderModel || '';
          if (wantAutoClips && falApiKey && modelForClips.includes('image-to-video')) {
            console.log(`Auto-generating missing motion clips via FAL (${modelForClips})...`);
            const outBucket = storage.bucket(outputBucketName);
            for (let i = 0; i < (scenes || []).length; i++) {
              const clipFile = outBucket.file(`${projectId}/clips/scene-${i}.mp4`);
              const [exists] = await clipFile.exists();
              const forceClips = !!(req.body && req.body.forceClips);
              if (exists && !forceClips) continue;

              const sceneImage = imageFiles.find(f => path.basename(f.name).startsWith(`scene-${i}-`));
              if (!sceneImage) { console.warn(`auto-clips: no image for scene ${i}`); continue; }
              const [signedUrl] = await inputBucket.file(sceneImage.name).getSignedUrl({ version: 'v4', action: 'read', expires: Date.now() + 60*60*1000 });
              const secs = Math.max(2, parseInt(String((scenes[i]?.duration) || req.body?.clipSeconds || process.env.FAL_IMAGE_TO_VIDEO_SECONDS || '8'), 10));
              try {
                const { fal } = await import('@fal-ai/client');
                fal.config({ credentials: falApiKey });
                const falInput = { prompt: req.body?.veoPrompt || `Cinematic short motion for scene ${i+1}.`, image_url: signedUrl, duration: secs, seconds: secs, video_length: secs };
                const mdl = modelForClips;
                const submit = await fal.queue.submit(mdl, { input: falInput, logs: false });
                const { requestId } = submit || {};
                if (!requestId) throw new Error('Missing FAL request id');
                const timeoutMs = parseInt(process.env.FAL_RENDER_TIMEOUT_MS || '600000', 10);
                const pollMs = parseInt(process.env.FAL_RENDER_POLL_MS || '3000', 10);
                const start = Date.now();
                while (Date.now() - start < timeoutMs) {
                  const st = await fal.queue.status(mdl, { requestId, logs: false });
                  const s = (st && st.status) || 'UNKNOWN';
                  if (s === 'COMPLETED' || s === 'COMPLETED_WITH_WARNINGS') break;
                  if (s === 'FAILED' || s === 'ERROR') throw new Error(`FAL status ${s}`);
                  await new Promise(r => setTimeout(r, pollMs));
                }
                const res = await fal.queue.result(mdl, { requestId });
                const resultUrl = (res && res.data && (res.data.video?.url || res.data.output?.[0]?.url || res.data.output?.video?.url)) || null;
                if (!resultUrl) throw new Error('No clip URL');
                const localClip = path.join(tempDir, `gen_clip_${i}.mp4`);
                const fetchRes = await fetch(resultUrl);
                if (!fetchRes.ok) throw new Error(`download ${fetchRes.status}`);
                const buff = Buffer.from(await fetchRes.arrayBuffer());
                await fs.writeFile(localClip, buff);
                await outBucket.upload(localClip, { destination: `${projectId}/clips/scene-${i}.mp4`, metadata: { contentType: 'video/mp4' } });
                console.log(`Saved clip for scene ${i} (${secs}s)`);
              } catch (e) {
                console.warn(`auto-clips: failed for scene ${i}:`, e?.message || e);
              }
            }
          }
        } catch (e) {
          console.warn('auto-clips block failed:', e?.message || e);
        }

        // 3. Per-scene processing (generate a video per scene with captions), then concatenate and add audio
        console.log('Starting per-scene FFmpeg processing...');

        // Helpers to parse and format SRT
        const parseSrt = (text) => {
          const blocks = String(text || '').split(/\r?\n\r?\n/);
          const toSeconds = (h,m,s,ms)=>parseInt(h,10)*3600+parseInt(m,10)*60+parseInt(s,10)+parseInt(ms,10)/1000;
          const entries=[]; for(const b of blocks){ const lines=b.trim().split(/\r?\n/); if(lines.length<2) continue; const m=(lines[1]||'').match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/); if(!m) continue; const start=toSeconds(m[1],m[2],m[3],m[4]); const end=toSeconds(m[5],m[6],m[7],m[8]); const text=lines.slice(2).join('\n'); entries.push({start,end,text}); }
          return entries;
        };
        const formatSrt = (entries) => {
          const toSrtTime = (t)=>{ if(t<0) t=0; const h=Math.floor(t/3600), m=Math.floor((t%3600)/60), s=Math.floor(t%60), ms=Math.round((t-Math.floor(t))*1000); const pad=(n,w=2)=>String(n).padStart(w,'0'); return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms,3)}`; };
          let i=1, out=''; for(const e of entries){ out += `${i++}\n${toSrtTime(e.start)} --> ${toSrtTime(e.end)}\n${e.text}\n\n`; } return out.trim()+"\n";
        };

        // Build scene offsets and load full captions
        const fullSrtPath = path.join(tempDir, 'captions.srt');
        let fullSrtText = ''; try { fullSrtText = await fs.readFile(fullSrtPath, 'utf8'); } catch {}
        const fullEntries = parseSrt(fullSrtText);
        const sceneOffsets = []; { let acc=0; for (const s of (scenes||[])) { sceneOffsets.push(acc); acc += (s?.duration||3); } }

        // Pre-fetch clips and ensure image fallbacks are local
        const outBucket = storage.bucket(outputBucketName);
        const clipLocalPaths = await Promise.all((scenes || []).map(async (_, i) => { try { const clipFile=outBucket.file(`${projectId}/clips/scene-${i}.mp4`); const [ex]=await clipFile.exists(); if(!ex) return null; const local=path.join(tempDir,`clip_${i}.mp4`); await clipFile.download({ destination: local }); return local; } catch { return null; } }));
        const localFirstImages = await Promise.all((scenes || []).map(async (_, i) => { try { const c=imageFiles.filter(f=>path.basename(f.name).startsWith(`scene-${i}-`)); if(!c.length) return null; const first=c[0]; const local=path.join(tempDir, path.basename(first.name)); try { await fs.stat(local); } catch { await inputBucket.file(first.name).download({ destination: local }); } return local; } catch { return null; } }));

        // Create per-scene silent MP4s with burnt-in scene captions
        const partPaths = [];
        for (let i=0;i<(scenes||[]).length;i++){
          const scene=scenes[i]; const duration=Math.max(1,scene?.duration||3); const offset=sceneOffsets[i]||0; const end=offset+duration;
          const segEntries = fullEntries.filter(e=>e.end>offset && e.start<end).map(e=>({ start: Math.max(0,e.start-offset), end: Math.max(0.01, Math.min(duration, e.end-offset)), text: e.text }));
          const segSrtPath = path.join(tempDir, `scene_${i}.srt`); try { await fs.writeFile(segSrtPath, formatSrt(segEntries), 'utf8'); } catch {}
          const inputClip = clipLocalPaths[i]; const inputImage = localFirstImages[i]; const partOut = path.join(tempDir, `part_${i}.mp4`);
          await new Promise((resolve,reject)=>{
            const cmd=ffmpeg(); let vf=`format=yuv420p,scale=${targetW}:${targetH}`;
            if (inputClip) { cmd.input(inputClip).inputOptions([`-t ${duration}`]); }
            else if (inputImage) {
              cmd.input(inputImage).inputOptions(['-loop 1', `-t ${duration}`]);
              switch (scene.camera||'static'){
                case 'zoom-in': vf=`zoompan=z='min(zoom+0.001,1.3)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${targetW}x${targetH},format=yuv420p`; break;
                case 'zoom-out': vf=`zoompan=z='if(lte(zoom,1.0),1.3,max(1.001,zoom-0.001))':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${targetW}x${targetH},format=yuv420p`; break;
                case 'pan-left': vf=`zoompan=z='1.1':d=1:x='iw/2-(iw/zoom/2)-50*sin(t)':y='ih/2-(ih/zoom/2)':s=${targetW}x${targetH},format=yuv420p`; break;
                case 'pan-right': vf=`zoompan=z='1.1':d=1:x='iw/2-(iw/zoom/2)+50*sin(t)':y='ih/2-(ih/zoom/2)':s=${targetW}x${targetH},format=yuv420p`; break;
                default: vf=`scale=${targetW}:${targetH},format=yuv420p`;
              }
            } else { cmd.input(`color=black:s=${targetW}x${targetH}:r=30`).inputOptions(['-f lavfi', `-t ${duration}`]); vf='format=yuv420p'; }
            const style = `force_style='Fontsize=18,PrimaryColour=&HFFFFFF&,OutlineColour=&H000000&,BorderStyle=3,Outline=1,Shadow=1,MarginV=25'`;
            let fullVf = `${vf},subtitles='${segSrtPath.replace(/'/g, "'\\''")}:${style}`; if (plan==='free'){ fullVf+=",drawtext=text='ReelBanana':fontcolor=white@0.6:fontsize=24:box=1:boxcolor=black@0.4:boxborderw=5:x=w-tw-10:y=h-th-10"; }
            cmd.videoFilters(fullVf)
              .outputOptions(['-an','-c:v libx264','-preset medium','-crf 22','-pix_fmt yuv420p','-movflags +faststart'])
              .on('end', resolve)
              .on('error', (err)=>{ console.error(`FFmpeg part ${i} error:`, err.message); reject(new Error('FFMPEG_FAILURE')); })
              .save(partOut);
          });
          partPaths.push(partOut);
        }

        // Concatenate parts (silent)
        const listPath = path.join(tempDir, 'concat_list.txt');
        const listContent = partPaths.map(p=>`file '${p.replace(/'/g, "'\\''")}'`).join('\n');
        await fs.writeFile(listPath, listContent, 'utf8');
        const silentConcatPath = path.join(tempDir, 'video_concat.mp4');
        await new Promise((resolve,reject)=>{
          ffmpeg().input(listPath).inputOptions(['-f concat','-safe 0'])
            .outputOptions(['-c:v libx264','-preset slow','-crf 22','-pix_fmt yuv420p','-movflags +faststart'])
            .on('end', resolve)
            .on('error',(err)=>{ console.error('FFmpeg concat error:', err.message); reject(new Error('FFMPEG_FAILURE')); })
            .save(silentConcatPath);
        });

        // Mux audio (narration + optional music with ducking)
        const outputVideoPath = path.join(tempDir, 'final_movie.mp4');
        await new Promise((resolve,reject)=>{
          const cmd=ffmpeg(); cmd.input(silentConcatPath); cmd.input(narrationLocalPath); if (musicLocalPath) cmd.input(musicLocalPath);
          const filterComplex = gsMusicPath
            ? `[${musicLocalPath ? 2 : 1}:a][1:a]sidechaincompress=threshold=0.05:ratio=6:attack=5:release=300[ducked];[ducked][1:a]amix=inputs=2:duration=first:dropout_transition=2,volume=1.0[final_audio]`
            : `[1:a]volume=0.9[final_audio]`;
          cmd.outputOptions(['-map 0:v:0','-map [final_audio]','-filter_complex',filterComplex,'-c:v libx264','-preset slow','-crf 22','-c:a aac','-b:a 192k','-pix_fmt yuv420p','-movflags +faststart','-shortest'])
            .on('end', resolve)
            .on('error',(err)=>{ console.error('FFmpeg mux error:', err.message); reject(new Error('FFMPEG_FAILURE')); })
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

        // Videos are uploaded to public bucket for direct GCS URL access
        const videoUrl = uploadedFile.publicUrl();
        console.log(`Video uploaded to public bucket for direct access`);
        
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
