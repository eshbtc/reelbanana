
const express = require('express');
const cors = require('cors');
const { ElevenLabsClient } = require('elevenlabs');
const { Storage } = require('@google-cloud/storage');
// Update ElevenLabs API key - trigger redeployment
const admin = require('firebase-admin');

const app = express();
app.use(express.json());
app.use(cors());

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'reel-banana-35a54'
  });
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

// --- CLIENT INITIALIZATION ---
// IMPORTANT: Set ELEVENLABS_API_KEY as an environment variable in your Cloud Run service
const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});
const storage = new Storage();
const bucketName = process.env.INPUT_BUCKET_NAME || 'reel-banana-35a54.firebasestorage.app';

/**
 * POST /narrate
 * Generates narration from a script and saves it to GCS.
 *
 * Request Body:
 * {
 *   "projectId": "string",
 *   "narrationScript": "The full text to be narrated."
 * }
 *
 * Response:
 * {
 *   "gsAudioPath": "gs://bucket-name/project-id/narration.mp3"
 * }
 */
app.post('/narrate', appCheckVerification, async (req, res) => {
  const { projectId, narrationScript, emotion } = req.body;

  if (!projectId || !narrationScript) {
    return sendError(req, res, 400, 'INVALID_ARGUMENT', 'Missing required fields: projectId and narrationScript');
  }

  if (!process.env.ELEVENLABS_API_KEY) {
    console.error('ELEVENLABS_API_KEY environment variable not set.');
    return sendError(req, res, 500, 'CONFIG', 'Missing ELEVENLABS_API_KEY environment variable');
  }
  
  console.log(`Received narration request for projectId: ${projectId}`);

  try {
    // Map simple emotion tags to ElevenLabs settings
    const settingsByEmotion = {
      neutral: { stability: 0.5, similarity_boost: 0.75 },
      warm: { stability: 0.6, similarity_boost: 0.8 },
      excited: { stability: 0.35, similarity_boost: 0.7 },
      mysterious: { stability: 0.45, similarity_boost: 0.7 },
      dramatic: { stability: 0.4, similarity_boost: 0.65 },
    };
    const voice_settings = settingsByEmotion[(emotion || 'neutral')] || settingsByEmotion.neutral;

    // 1. Generate audio stream from ElevenLabs using direct API call
    console.log(`Starting ElevenLabs TTS for ${projectId}, text length: ${narrationScript.length} chars`);
    
    const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM', {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': process.env.ELEVENLABS_API_KEY
      },
      body: JSON.stringify({
        text: narrationScript,
        model_id: "eleven_multilingual_v2",
        voice_settings
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`ElevenLabs API error: ${response.status} ${response.statusText} - ${errorText}`);
      throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
    }

    const audioStream = response.body;
    console.log(`ElevenLabs TTS stream created successfully for ${projectId}`);

    // 2. Stream the audio directly to Google Cloud Storage
    const bucket = storage.bucket(bucketName);
    const fileName = `${projectId}/narration.mp3`;
    const file = bucket.file(fileName);
    const writeStream = file.createWriteStream({
      metadata: { contentType: 'audio/mpeg' },
    });

    // Add error handling to the audio stream
    audioStream.on('error', (streamError) => {
      console.error(`ElevenLabs audio stream error for ${projectId}:`, streamError);
      writeStream.destroy(streamError);
    });

    // Pipe the audio stream to the GCS write stream
    audioStream.pipe(writeStream);

    // Wait for the stream to finish writing
    await new Promise((resolve, reject) => {
      writeStream.on('finish', () => {
        console.log(`Stream finished successfully for ${projectId}`);
        resolve();
      });
      writeStream.on('error', (writeError) => {
        console.error(`GCS write stream error for ${projectId}:`, writeError);
        reject(writeError);
      });
      
      // Add timeout to prevent hanging
      setTimeout(() => {
        reject(new Error('Stream timeout after 60 seconds'));
      }, 60000);
    });

    const gcsPath = `gs://${bucketName}/${fileName}`;
    console.log(`Successfully uploaded narration for ${projectId} to ${gcsPath}`);

    res.status(200).json({ gsAudioPath: gcsPath });

  } catch (error) {
    console.error(`Error generating narration for projectId ${projectId}:`, error);
    return sendError(req, res, 500, 'INTERNAL', 'Failed to generate narration.', error.message);
  }
});

// Lightweight health check (no App Check required)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'narrate',
    elevenlabsConfigured: !!process.env.ELEVENLABS_API_KEY,
    bucket: bucketName,
    time: new Date().toISOString()
  });
});

// Note: No music generation endpoint is included here as per the latest stable implementation.

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Narration service listening on port ${PORT}`);
});
