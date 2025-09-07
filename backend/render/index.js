
const express = require('express');
const cors = require('cors');
const { Storage } = require('@google-cloud/storage');
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
const inputBucketName = process.env.INPUT_BUCKET_NAME || 'reel-banana-35a54.appspot.com';
const outputBucketName = process.env.OUTPUT_BUCKET_NAME || 'reel-banana-35a54.appspot.com';

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
    const { projectId, scenes, gsAudioPath, srtPath, gsMusicPath } = req.body;

    if (!projectId) {
        return sendError(req, res, 400, 'INVALID_ARGUMENT', 'Missing required field: projectId');
    }

    console.log(`Received render request for projectId: ${projectId}`);
    
    // Declare tempDir outside try block so it's accessible in finally
    let tempDir;
    console.log('🔧 Render service: tempDir scope fix applied');
    
    try {
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

        // 1. Setup: Create a temporary local directory for processing
        await fs.mkdir(tempDir, { recursive: true });

        // 2. Download all necessary assets from GCS
        console.log('Downloading assets...');
        const inputBucket = storage.bucket(inputBucketName);
        const imageFiles = (await inputBucket.getFiles({ prefix: `${projectId}/scene-` }))[0];
        
        console.log(`Found ${imageFiles.length} image files:`, imageFiles.map(f => f.name));
        
        // Debug: Also check for any files in the project directory
        const allProjectFiles = (await inputBucket.getFiles({ prefix: `${projectId}/` }))[0];
        console.log(`All project files (${allProjectFiles.length}):`, allProjectFiles.map(f => f.name));
        
        // Resolve the correct remote audio and music filenames
        let musicLocalPath = null;
        let narrationLocalPath = path.join(tempDir, 'narration.mp3');
        
        // Derive audio path from gsAudioPath if provided
        let remoteAudio = `${projectId}/narration.mp3`; // Default fallback
        if (gsAudioPath) {
            const prefix = `gs://${inputBucketName}/`;
            if (gsAudioPath.startsWith(prefix)) {
                const rel = gsAudioPath.substring(prefix.length);
                if (rel && rel.includes(projectId + '/')) {
                    remoteAudio = rel;
                }
            }
        }
        
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
            const sceneOutput = `scene_clip_${sceneIndex}`;
            const duration = scene.duration || 3;
            
            console.log(`Processing scene ${sceneIndex} with image: ${localImagePath}`);
            
            command.input(localImagePath)
                .inputOptions(['-loop 1']) // Loop the single image
                .inputOptions([`-t ${duration}`]) // Duration in seconds
                .videoCodec('libx264');

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
            command
                .input(narrationLocalPath) // narration audio track
            
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

// Lightweight health check (no App Check required)
// Health check endpoints
createHealthEndpoints(app, 'render', 
  {
    inputBucket: inputBucketName,
    outputBucket: outputBucketName
  },
  {
    dependencies: {
      gcs: () => commonDependencyChecks.gcs(inputBucketName),
      firebase: () => commonDependencyChecks.firebase()
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
