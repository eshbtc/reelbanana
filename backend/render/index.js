
const express = require('express');
const cors = require('cors');
const { Storage } = require('@google-cloud/storage');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs/promises');
const path = require('path');
const admin = require('firebase-admin');

const app = express();
app.use(express.json());
app.use(cors());

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
const inputBucketName = process.env.INPUT_BUCKET_NAME || 'oneminute-movie-in';
const outputBucketName = process.env.OUTPUT_BUCKET_NAME || 'oneminute-movie-out';

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
app.post('/render', appCheckVerification, async (req, res) => {
    const { projectId, scenes, gsAudioPath, srtPath, gsMusicPath } = req.body;

    if (!projectId || !scenes || !gsAudioPath || !srtPath) {
        return sendError(req, res, 400, 'INVALID_ARGUMENT', 'Missing required fields for rendering.');
    }

    console.log(`Received render request for projectId: ${projectId}`);
    const tempDir = path.join('/tmp', projectId);

    try {
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
        
        const downloadPromises = [
            ...imageFiles.map(file => file.download({ destination: path.join(tempDir, path.basename(file.name)) })),
            inputBucket.file(`${projectId}/narration.mp3`).download({ destination: path.join(tempDir, 'narration.mp3') }),
            inputBucket.file(`${projectId}/captions.srt`).download({ destination: path.join(tempDir, 'captions.srt') }),
        ];
        
        // Download music file if provided
        if (gsMusicPath) {
            downloadPromises.push(inputBucket.file(`${projectId}/music.mp3`).download({ destination: path.join(tempDir, 'music.mp3') }));
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
            const imagePattern = path.join(tempDir, `scene-${sceneIndex}-%d.jpeg`);
            const sceneOutput = `scene_clip_${sceneIndex}`;
            const duration = scene.duration || 3;
            
            command.input(imagePattern)
                .inputOptions(['-framerate 1.5']) // Each image shows for ~0.66 seconds
                .loop(duration) // Dynamic duration based on user setting
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
                .input(path.join(tempDir, 'narration.mp3')) // Add narration audio track
            
            // Add music track if available
            if (gsMusicPath) {
                command.input(path.join(tempDir, 'music.mp3')); // Add music track
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
        const outputBucket = storage.bucket(outputBucketName);
        const [uploadedFile] = await outputBucket.upload(outputVideoPath, {
            destination: `${projectId}/movie.mp4`,
            metadata: { contentType: 'video/mp4' },
        });
        
        // Generate a V4 signed URL instead of making the file public
        const [signedUrl] = await uploadedFile.getSignedUrl({
            version: 'v4',
            action: 'read',
            expires: Date.now() + 60 * 60 * 1000, // 1 hour
        });
        
        console.log(`Video uploaded successfully with signed URL`);
        res.status(200).json({ videoUrl: signedUrl });

    } catch (error) {
        console.error(`Error rendering video for projectId ${projectId}:`, error);
        if (error && error.message === 'FFMPEG_FAILURE') {
          return sendError(req, res, 500, 'FFMPEG_FAILURE', 'FFmpeg failed to render the video.');
        }
        return sendError(req, res, 500, 'INTERNAL', 'Failed to render video.', error.message);
    } finally {
        // 5. Cleanup: Remove the temporary local directory
        await fs.rm(tempDir, { recursive: true, force: true });
        console.log(`Cleaned up temporary directory: ${tempDir}`);
    }
});

// Lightweight health check (no App Check required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'render', inputBucket: inputBucketName, outputBucket: outputBucketName, time: new Date().toISOString() });
});


const PORT = process.env.PORT || 8082;
app.listen(PORT, () => {
  console.log(`Render service listening on port ${PORT}`);
});
