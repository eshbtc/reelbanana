// Force deployment for demo sync

const express = require('express');
const cors = require('cors');
const { ElevenLabsClient } = require('elevenlabs');
const { createHash } = require('crypto');
const { Storage } = require('@google-cloud/storage');
// Update ElevenLabs API key - trigger redeployment
const admin = require('firebase-admin');
const { createExpensiveOperationLimiter } = require('./shared/rateLimiter');
const { createHealthEndpoints, commonDependencyChecks } = require('./shared/healthCheck');

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

// Normalize scripts for cache matching (punctuation/spacing/quotes)
function normalizeScriptForCache(text) {
  if (!text) return '';
  let s = String(text).trim();
  s = s
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/([!?.,])\1+/g, '$1'); // collapse repeated punct
  return s.toLowerCase();
}

// Content-addressable cache key for TTS results (supports exact and normalized)
function ttsCacheKey({ text, voiceId, emotion, normalized = false }) {
  const base = normalized ? normalizeScriptForCache(text) : String(text || '').trim();
  const payload = JSON.stringify({ v: 2, base, voiceId: voiceId || '21m00Tcm4TlvDq8ikWAM', emotion: emotion || 'neutral' });
  return createHash('sha256').update(payload).digest('hex');
}

// Simple cache metrics
const cacheMetrics = {
  hits: 0,
  writes: 0,
};

// Retry utility with exponential backoff
async function retryWithBackoff(operation, maxRetries = 3, baseDelay = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.log(`Attempt ${attempt} failed, retrying in ${delay}ms:`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

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
app.post('/narrate', ...createExpensiveOperationLimiter('narrate'), appCheckVerification, async (req, res) => {
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
    // Check if narration file already exists to avoid re-generating
    const bucket = storage.bucket(bucketName);
    const fileName = `${projectId}/narration.mp3`;
    const file = bucket.file(fileName);
    
    const [exists] = await file.exists();
    if (exists) {
      const gcsPath = `gs://${bucketName}/${fileName}`;
      console.log(`Narration already exists for ${projectId} at ${gcsPath}, skipping ElevenLabs API call`);
      return res.status(200).json({ 
        gsAudioPath: gcsPath,
        cached: true 
      });
    }

    // Global content-addressable cache (cross-project: exact then normalized)
    const exactId = ttsCacheKey({ text: narrationScript, voiceId: '21m00Tcm4TlvDq8ikWAM', emotion, normalized: false });
    const normId  = ttsCacheKey({ text: narrationScript, voiceId: '21m00Tcm4TlvDq8ikWAM', emotion, normalized: true });
    const exactFile = bucket.file(`cache/narrate/exact/${exactId}.mp3`);
    const normFile  = bucket.file(`cache/narrate/norm/${normId}.mp3`);
    const [[exactExists],[normExists]] = await Promise.all([exactFile.exists(), normFile.exists()]);
    if (exactExists || normExists) {
      const source = exactExists ? exactFile : normFile;
      await source.copy(file);
      const gcsPath = `gs://${bucketName}/${fileName}`;
      console.log(`Narration cache hit ${exactExists ? exactId : normId} (${exactExists ? 'exact' : 'norm'}); copied to ${gcsPath}`);
      cacheMetrics.hits++;
      return res.status(200).json({ gsAudioPath: gcsPath, cached: true, cacheId: exactExists ? exactId : normId });
    }
    
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

    console.log(`ElevenLabs TTS stream created successfully for ${projectId}`);

    // 2. Stream the audio directly to Google Cloud Storage with retry logic
    // Reuse the bucket, fileName, and file variables from the exists check above
    await retryWithBackoff(async () => {
      return new Promise((resolve, reject) => {
        const writeStream = file.createWriteStream({
          metadata: { contentType: 'audio/mpeg' },
        });

        // Convert fetch ReadableStream to Node.js stream and pipe to GCS
        const { Readable } = require('stream');
        const audioStream = Readable.fromWeb(response.body);
        
        // Add error handling to the audio stream
        audioStream.on('error', (streamError) => {
          console.error(`ElevenLabs audio stream error for ${projectId}:`, streamError);
          writeStream.destroy(streamError);
          reject(streamError);
        });
        
        writeStream.on('error', (writeError) => {
          console.error(`GCS write error for ${projectId}:`, writeError);
          reject(writeError);
        });
        
        writeStream.on('finish', () => {
          console.log(`Audio successfully streamed to GCS for ${projectId}`);
          resolve();
        });
        
        // Add timeout to prevent hanging
        setTimeout(() => {
          reject(new Error('Stream timeout after 60 seconds'));
        }, 60000);
        
        audioStream.pipe(writeStream);
      });
    });

    const gcsPath = `gs://${bucketName}/${fileName}`;
    console.log(`Successfully uploaded narration for ${projectId} to ${gcsPath}`);

    // Save to global cache (both exact and normalized variants) for future reuse
    try {
      await Promise.all([
        file.copy(exactFile),
        file.copy(normFile)
      ]);
      console.log(`Saved narration to cache keys exact=${exactId}, norm=${normId}`);
      cacheMetrics.writes++;
    } catch (e) {
      console.warn('Failed to write narration cache:', e.message);
    }

    res.status(200).json({ gsAudioPath: gcsPath });

  } catch (error) {
    console.error(`Error generating narration for projectId ${projectId}:`, error);
    return sendError(req, res, 500, 'INTERNAL', 'Failed to generate narration.', error.message);
  }
});

// Lightweight health check (no App Check required)
// Health check endpoints
createHealthEndpoints(app, 'narrate', 
  {
    elevenlabsConfigured: !!process.env.ELEVENLABS_API_KEY,
    bucket: bucketName
  },
  {
    dependencies: {
      elevenlabs: () => commonDependencyChecks.elevenlabs(),
      gcs: () => commonDependencyChecks.gcs(bucketName),
      firebase: () => commonDependencyChecks.firebase()
    }
  }
);

// Cache status (protected)
app.get('/cache-status', appCheckVerification, (req, res) => {
  res.json({
    service: 'narrate',
    bucket: bucketName,
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
    const bucket = storage.bucket(bucketName);
    const result = { deleted: [] };

    const safeDelete = async (path) => {
      try { const f = bucket.file(path); const [ex] = await f.exists(); if (ex) { await f.delete(); result.deleted.push(path); } } catch {}
    };

    if (projectId) {
      await safeDelete(`${projectId}/narration.mp3`);
    }
    if (cacheId) {
      await safeDelete(`cache/narrate/exact/${cacheId}.mp3`);
      await safeDelete(`cache/narrate/norm/${cacheId}.mp3`);
    }
    res.json({ status: 'ok', ...result });
  } catch (e) {
    sendError(req, res, 500, 'INTERNAL', 'Failed to clear cache', e?.message);
  }
});

// Note: No music generation endpoint is included here as per the latest stable implementation.

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Narration service listening on port ${PORT}`);
});
