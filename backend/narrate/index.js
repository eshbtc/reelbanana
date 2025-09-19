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
const { requireCredits, deductCreditsAfter, completeCreditOperation } = require('../shared/creditService');

const app = express();

// Trust the first proxy (Cloud Run/GFE) for correct IPs without being permissive
app.set('trust proxy', 1);

app.use(express.json());
// Dynamic CORS allowlist
const defaultOrigins = [
  'https://reelbanana.ai',
  'https://reel-banana-35a54.web.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:8080'
];
const allowedOrigins = (process.env.ALLOWED_ORIGINS || defaultOrigins.join(',')).split(',').map(s => s.trim()).filter(Boolean);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(cors({
  origin: (origin, cb) => { if (!origin) return cb(null, true); return cb(null, allowedOrigins.includes(origin)); },
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

// Verify Firebase ID token and attach req.user
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }
    const idToken = authHeader.split('Bearer ')[1];
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Token verification failed:', error);
    return res.status(401).json({ error: 'Invalid authentication token' });
  }
};

// App Check or admin bypass (requires verifyToken before)
const appCheckOrAdmin = async (req, res, next) => {
  try {
    const uid = req.user && req.user.uid;
    if (uid) {
      try {
        const db = admin.firestore();
        const userDoc = await db.collection('users').doc(uid).get();
        if (userDoc.exists && userDoc.data().isAdmin === true) {
          return next();
        }
      } catch (_) {}
    }
  } catch (_) {}
  return appCheckVerification(req, res, next);
};

// Simple in-memory progress store for SSE (best-effort)
const progressStore = new Map(); // jobId -> { progress, stage, message, etaSeconds, done, error, ts }
const sseClients = new Map();    // jobId -> Set(res)
const progressWriteTs = new Map();
async function pushProgress(jobId, update) {
  if (!jobId) return;
  const prev = progressStore.get(jobId) || {};
  const next = {
    progress: typeof update.progress === 'number' ? Math.max(0, Math.min(100, update.progress)) : (prev.progress || 0),
    stage: update.stage || prev.stage || '',
    message: update.message || prev.message || '',
    etaSeconds: (typeof update.etaSeconds === 'number' ? update.etaSeconds : prev.etaSeconds),
    done: !!update.done,
    error: update.error || null,
    ts: Date.now(),
  };
  progressStore.set(jobId, next);
  const clients = sseClients.get(jobId);
  if (clients && clients.size) {
    const payload = `data: ${JSON.stringify({ jobId, ...next })}\n\n`;
    for (const res of clients) { try { res.write(payload); } catch {} }
  }
  try {
    const now = Date.now();
    const last = progressWriteTs.get(jobId) || 0;
    if (now - last > 900 || next.done || next.error) {
      progressWriteTs.set(jobId, now);
      const db = admin.firestore();
      await db.collection('job_progress').doc(jobId).set({
        jobId,
        service: 'narrate',
        progress: next.progress,
        stage: next.stage,
        message: next.message,
        etaSeconds: next.etaSeconds || null,
        done: next.done,
        error: next.error || null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }
  } catch {}
}

// SSE endpoint
app.get('/progress-stream', appCheckVerification, (req, res) => {
  const jobId = (req.query.jobId || '').toString();
  if (!jobId) return sendError(req, res, 400, 'INVALID_ARGUMENT', 'Missing jobId');
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders && res.flushHeaders();
  const snap = progressStore.get(jobId);
  if (snap) res.write(`data: ${JSON.stringify({ jobId, ...snap })}\n\n`);
  else {
    try {
      const db = admin.firestore();
      db.collection('job_progress').doc(jobId).get().then(doc => {
        if (doc.exists) {
          const data = doc.data() || {};
          const payload = `data: ${JSON.stringify({ jobId, progress: data.progress||0, stage: data.stage||'', message: data.message||'', etaSeconds: data.etaSeconds||null, done: !!data.done, error: data.error||null })}\n\n`;
          try { res.write(payload); } catch {}
        }
      });
    } catch {}
  }
  if (!sseClients.has(jobId)) sseClients.set(jobId, new Set());
  sseClients.get(jobId).add(res);
  req.on('close', () => { const set = sseClients.get(jobId); if (set) set.delete(res); });
});

// Debug: whoami (admin-bypass protected)
app.get('/whoami', verifyToken, appCheckOrAdmin, async (req, res) => {
  try {
    const uid = req.user?.uid || null;
    let isAdmin = false;
    if (uid) {
      try { const doc = await admin.firestore().collection('users').doc(uid).get(); isAdmin = !!(doc.exists && doc.data().isAdmin === true); } catch (_) {}
    }
    res.json({ uid, isAdmin, hasAppCheck: !!req.appCheckClaims });
  } catch (e) { res.status(500).json({ error: 'whoami_failed' }); }
});

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

// --- CLIENT INITIALIZATION ---
// IMPORTANT: Set ELEVENLABS_API_KEY as an environment variable in your Cloud Run service
const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});
const storage = new Storage();
const bucketName = process.env.INPUT_BUCKET_NAME || 'reel-banana-35a54.firebasestorage.app';

// Function to get user's ElevenLabs API key if available
async function getUserElevenLabsKey(userId) {
  try {
    const db = admin.firestore();
    const keyDoc = await db.collection('user_api_keys').doc(userId).get();
    
    if (!keyDoc.exists) {
      return null;
    }
    
    const keyData = keyDoc.data();
    if (!keyData.hasApiKey_elevenlabs || !keyData.encryptedApiKey_elevenlabs) {
      return null;
    }
    
    // Decrypt the API key (using the same KMS setup as api-key-service)
    const { KeyManagementServiceClient } = require('@google-cloud/kms');
    const kmsClient = new KeyManagementServiceClient();
    const projectId = 'reel-banana-35a54';
    const locationId = 'global';
    const keyRingId = 'api-keys';
    const keyId = 'user-api-keys';
    
    const name = kmsClient.cryptoKeyPath(projectId, locationId, keyRingId, keyId);
    const [result] = await kmsClient.decrypt({
      name: name,
      ciphertext: Buffer.from(keyData.encryptedApiKey_elevenlabs, 'base64'),
      additionalAuthenticatedData: Buffer.from(userId)
    });
    
    return result.plaintext.toString();
  } catch (error) {
    console.warn('Failed to get user ElevenLabs key:', error);
    return null;
  }
}

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
app.post('/narrate', 
  verifyToken,
  requireCredits('narration', (req) => ({ textLength: req.body.narrationScript?.length || 0 })),
  deductCreditsAfter('narration', (req) => ({ textLength: req.body.narrationScript?.length || 0 })),
  ...createExpensiveOperationLimiter('narrate'), 
  appCheckOrAdmin, 
  async (req, res) => {
  const { projectId, narrationScript, emotion, voiceId, jobId: providedJobId } = req.body;
  const jobId = (providedJobId && String(providedJobId)) || `narrate-${projectId}-${Date.now()}`;

  if (!projectId || !narrationScript) {
    return sendError(req, res, 400, 'INVALID_ARGUMENT', 'Missing required fields: projectId and narrationScript');
  }
  
  console.log(`Received narration request for projectId: ${projectId}`);

  // Get user ID from token for BYO ElevenLabs key check
  let userId = null;
  let userElevenLabsKey = null;
  try {
    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
      const idToken = authHeader.split('Bearer ')[1];
      const decoded = await admin.auth().verifyIdToken(idToken);
      userId = decoded.uid;
      
      // Try to get user's ElevenLabs API key
      userElevenLabsKey = await getUserElevenLabsKey(userId);
      if (userElevenLabsKey) {
        console.log(`Using user's ElevenLabs API key for user: ${userId}`);
      }
    }
  } catch (error) {
    console.warn('Failed to get user ID or ElevenLabs key:', error);
  }

  // Use user's key if available, otherwise fall back to platform key
  const elevenLabsApiKey = userElevenLabsKey || process.env.ELEVENLABS_API_KEY;
  
  if (!elevenLabsApiKey) {
    console.error('No ElevenLabs API key available (neither user key nor platform key)');
    return sendError(req, res, 500, 'CONFIG', 'No ElevenLabs API key available');
  }

  try {
    // Check if narration file already exists to avoid re-generating
    const bucket = storage.bucket(bucketName);
    const fileName = `${projectId}/narration.mp3`;
    const file = bucket.file(fileName);
    
    const [exists] = await file.exists();
    if (exists) {
      const gcsPath = `gs://${bucketName}/${fileName}`;
      console.log(`Narration already exists for ${projectId} at ${gcsPath}, skipping ElevenLabs API call`);
      try { pushProgress(jobId, { progress: 100, stage: 'narrating', message: 'Cached narration', done: true }); } catch {}
      return res.status(200).json({ 
        gsAudioPath: gcsPath,
        cached: true 
      });
    }

    // Global content-addressable cache (cross-project: exact then normalized)
    const selectedVoiceId = voiceId || '21m00Tcm4TlvDq8ikWAM'; // Default to Rachel if not provided
    const exactId = ttsCacheKey({ text: narrationScript, voiceId: selectedVoiceId, emotion, normalized: false });
    const normId  = ttsCacheKey({ text: narrationScript, voiceId: selectedVoiceId, emotion, normalized: true });
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
    console.log(`Starting ElevenLabs TTS for ${projectId}, text length: ${narrationScript.length} chars, voice: ${selectedVoiceId}`);
    pushProgress(jobId, { progress: 10, stage: 'narrating', message: `Calling TTS provider with voice ${selectedVoiceId}…` });
    
    let response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': elevenLabsApiKey
      },
      body: JSON.stringify({
        text: narrationScript,
        model_id: "eleven_multilingual_v2",
        voice_settings
      })
    });

    let providerUsed = userElevenLabsKey ? 'user' : 'platform';
    
    // If user key fails with 401/403, fallback to platform key
    if (!response.ok && (response.status === 401 || response.status === 403) && userElevenLabsKey && process.env.ELEVENLABS_API_KEY) {
      console.warn(`User ElevenLabs key failed (${response.status}), falling back to platform key`);
      response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}`, {
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
      providerUsed = 'platform';
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`ElevenLabs API error: ${response.status} ${response.statusText} - ${errorText} (provider: ${providerUsed})`);
      throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText} (provider: ${providerUsed})`);
    }
    
    console.log(`ElevenLabs TTS completed successfully using ${providerUsed} key`);

    console.log(`ElevenLabs TTS stream created successfully for ${projectId}`);

    // Read the response once into a Buffer so retries don't reuse a locked stream
    // (ReadableStreams can only be consumed once)
    const audioArrayBuffer = await response.arrayBuffer();
    const audioBuffer = Buffer.from(audioArrayBuffer);

    // Optional: spool to ephemeral disk (/tmp) when audio size exceeds threshold
    // This keeps memory stable under concurrency. Cloud Run allows writing to /tmp.
    const bytesToMB = (n) => Math.round((n / (1024 * 1024)) * 100) / 100;
    const thresholdMB = parseInt(process.env.NARRATE_SPOOL_THRESHOLD_MB || '8', 10); // default 8MB
    const audioSizeMB = bytesToMB(audioBuffer.length);
    let tmpPath = null;
    try {
      if (audioSizeMB >= thresholdMB) {
        const os = require('os');
        const path = require('path');
        const fsp = require('fs/promises');
        tmpPath = path.join(os.tmpdir(), `narrate_${projectId}_${Date.now()}.mp3`);
        await fsp.writeFile(tmpPath, audioBuffer);
        console.log(`Spooling narration to disk: ${tmpPath} (${audioSizeMB} MB)`);
      }
    } catch (e) {
      console.warn('Failed to spool narration to disk; falling back to in-memory buffer:', e?.message || e);
      tmpPath = null;
    }

    // 2. Upload audio to GCS with retry logic
    const sizeBytes = tmpPath
      ? (() => { try { return require('fs').statSync(tmpPath).size; } catch { return audioBuffer.length; } })()
      : audioBuffer.length;
    const saveThresholdMB = parseInt(process.env.NARRATE_FILE_SAVE_THRESHOLD_MB || '16', 10);
    const preferFileSave = sizeBytes <= saveThresholdMB * 1024 * 1024;
    console.log(`[NARRATE] Upload method=${preferFileSave ? 'file.save' : 'stream'} size=${sizeBytes} bytes tmp=${!!tmpPath} bucket=${bucketName} object=${fileName}`);

    await retryWithBackoff(async () => {
      const t0 = Date.now();
      if (preferFileSave) {
        // Simple buffered upload (robust for small files)
        const payload = tmpPath ? await require('fs/promises').readFile(tmpPath) : audioBuffer;
        await file.save(payload, { metadata: { contentType: 'audio/mpeg' } });
        const dt = Date.now() - t0;
        console.log(`[NARRATE] file.save completed in ${dt} ms (${sizeBytes} bytes)`);
        try { pushProgress(jobId, { progress: 90, stage: 'narrating', message: 'Uploaded to storage' }); } catch {}
        return;
      }
      // Streaming path with progress (for larger files)
      await new Promise((resolve, reject) => {
        const writeStream = file.createWriteStream({ metadata: { contentType: 'audio/mpeg' } });
        const { Readable } = require('stream');
        const fs = require('fs');
        const audioStream = tmpPath ? fs.createReadStream(tmpPath) : Readable.from(audioBuffer);

        let written = 0;
        const total = sizeBytes || 1;
        const logEveryBytes = Math.max(256 * 1024, Math.floor(total / 10)); // ~10% or 256KB

        audioStream.on('data', (chunk) => {
          written += chunk.length;
          if (written % logEveryBytes < chunk.length) {
            const pct = Math.min(100, Math.round((written / total) * 100));
            console.log(`[NARRATE] streaming progress ${written}/${total} (${pct}%)`);
            try { pushProgress(jobId, { progress: Math.min(95, 60 + Math.round((written / total) * 35)), stage: 'narrating', message: `Uploading audio… ${pct}%` }); } catch {}
          }
        });

        audioStream.on('error', (err) => {
          console.error(`[NARRATE] audio stream error: ${err?.message || err}`);
          writeStream.destroy(err);
          reject(err);
        });
        writeStream.on('error', (err) => {
          console.error(`[NARRATE] GCS write error: ${err?.message || err}`);
          reject(err);
        });
        writeStream.on('finish', () => {
          const dt = Date.now() - t0;
          console.log(`[NARRATE] stream upload finished in ${dt} ms (${written} bytes)`);
          resolve();
        });

        // Timeout watchdog
        const timeoutMs = parseInt(process.env.NARRATE_STREAM_TIMEOUT_MS || '300000', 10);
        const timeoutId = setTimeout(() => {
          reject(new Error(`Stream timeout after ${timeoutMs} ms`));
        }, timeoutMs);

        writeStream.on('close', () => { try { clearTimeout(timeoutId); } catch {} });
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

    // Complete credit operation
    if (req.creditDeduction?.idempotencyKey) {
      await completeCreditOperation(req.creditDeduction.idempotencyKey, 'completed');
    }

    // Cleanup temp file if we spooled to disk
    if (tmpPath && String(process.env.NARRATE_KEEP_TEMP || '0') !== '1') {
      try {
        const fsp = require('fs/promises');
        await fsp.unlink(tmpPath);
        console.log('Cleaned temp narration file:', tmpPath);
      } catch (e) { console.warn('Failed to remove temp file:', e?.message || e); }
    }

    try { pushProgress(jobId, { progress: 100, stage: 'narrating', message: 'Narration ready', done: true }); } catch {}
    res.status(200).json({ gsAudioPath: gcsPath });

  } catch (error) {
    console.error(`Error generating narration for projectId ${projectId}:`, error);
    
    // Mark credit operation as failed
    if (req.creditDeduction?.idempotencyKey) {
      await completeCreditOperation(req.creditDeduction.idempotencyKey, 'failed', error.message);
    }
    
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
