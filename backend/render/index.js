// Force deployment for demo sync

// Render service with Veo3 Fast model support - Updated for proper audio sync v2
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
const { requireCredits, deductCreditsAfter, completeCreditOperation } = require('../shared/creditService');
const { mapPlanIdToTier, getPlanConfig } = require('./shared/planMapper');

const app = express();

// Helper function to extract video URL from FAL response
const pickUrl = (j) => j?.output_url || j?.result?.url || j?.data?.url || j?.output?.url || j?.video?.url || null;

// Trust the first proxy (Cloud Run/GFE) for correct IPs without being permissive
app.set('trust proxy', 1);

app.use(express.json());

// Dynamic CORS (allowlist via env)
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
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    return cb(null, allowedOrigins.includes(origin));
  },
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

// In-memory progress store and SSE client registry (best-effort; Cloud Run instances are ephemeral)
const progressStore = new Map(); // jobId -> { progress, stage, message, etaSeconds, done, error, ts }
const sseClients = new Map();    // jobId -> Set(res)
const progressWriteTs = new Map();

async function pushProgress(jobId, update) {
  const prev = progressStore.get(jobId) || {};
  const next = {
    progress: typeof update.progress === 'number' ? Math.max(0, Math.min(100, update.progress)) : (prev.progress || 0),
    stage: update.stage || prev.stage || '',
    message: update.message || prev.message || '',
    etaSeconds: (typeof update.etaSeconds === 'number' ? update.etaSeconds : prev.etaSeconds),
    done: !!update.done,
    error: update.error || null,
    ts: Date.now(),
    perScene: (() => {
      const prevMap = prev.perScene || {};
      const inc = update.perScene || null;
      if (!inc) return prevMap;
      return { ...prevMap, ...inc };
    })(),
    sceneCount: typeof update.sceneCount === 'number' ? update.sceneCount : (prev.sceneCount || null),
    currentScene: typeof update.currentScene === 'number' ? update.currentScene : (prev.currentScene || null),
  };
  progressStore.set(jobId, next);
  const clients = sseClients.get(jobId);
  if (clients && clients.size) {
    const payload = `data: ${JSON.stringify({ jobId, ...next })}\n\n`;
    console.log(`[SSE] Broadcasting to ${clients.size} clients for job ${jobId}: ${next.stage} (${next.progress}%)`);
    for (const res of clients) {
      try {
        res.write(payload);
        if (res.flush) res.flush(); // Force flush for immediate delivery
      } catch (e) {
        console.error(`[SSE] Failed to write to client:`, e.message);
      }
    }
  }
  // Persist to Firestore (throttled)
  try {
    const now = Date.now();
    const last = progressWriteTs.get(jobId) || 0;
    if (now - last > 900 || next.done || next.error) {
      progressWriteTs.set(jobId, now);
      const db = admin.firestore();
      await db.collection('job_progress').doc(jobId).set({
        jobId,
        service: 'render',
        progress: next.progress,
        stage: next.stage,
        message: next.message,
        etaSeconds: next.etaSeconds || null,
        done: next.done,
        error: next.error || null,
        perScene: next.perScene || {},
        sceneCount: next.sceneCount || null,
        currentScene: next.currentScene || null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }
  } catch (e) { /* non-fatal */ }
}

// SSE endpoint for job progress
app.get('/progress-stream', (req, res) => {
  // App Check verification - but don't block SSE
  const appCheckToken = req.headers['x-firebase-appcheck'];
  if (!DEV_MODE && !appCheckToken) {
    console.warn('[SSE] Missing App Check token');
  }

  const jobId = (req.query.jobId || '').toString();
  if (!jobId) {
    return sendError(req, res, 400, 'INVALID_ARGUMENT', 'Missing jobId');
  }

  // CORS headers for SSE
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // SSE headers - Cloud Run compatible
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Write initial connection message and flush immediately
  res.write(': SSE connection established\n\n');
  if (res.flushHeaders) res.flushHeaders();
  if (res.flush) res.flush();

  console.log(`[SSE] Client connected for job ${jobId}`);

  // Send initial snapshot if present
  const snap = progressStore.get(jobId);
  if (snap) {
    res.write(`data: ${JSON.stringify({ jobId, ...snap })}\n\n`);
  }
  // Also try Firestore snapshot for persistence
  try {
    if (!snap) {
      const db = admin.firestore();
      db.collection('job_progress').doc(jobId).get().then(doc => {
        if (doc.exists) {
          const data = doc.data() || {};
          const payload = `data: ${JSON.stringify({ jobId, progress: data.progress||0, stage: data.stage||'', message: data.message||'', etaSeconds: data.etaSeconds||null, done: !!data.done, error: data.error||null })}\n\n`;
          try { res.write(payload); } catch {}
        }
      }).catch(()=>{});
    }
  } catch {}
  // Register client
  if (!sseClients.has(jobId)) sseClients.set(jobId, new Set());
  sseClients.get(jobId).add(res);

  // Send heartbeat to keep connection alive
  const heartbeat = setInterval(() => {
    try {
      res.write(':heartbeat\n\n');
    } catch (e) {
      clearInterval(heartbeat);
    }
  }, 30000); // Every 30 seconds

  // Clean up on close
  req.on('close', () => {
    clearInterval(heartbeat);
    const set = sseClients.get(jobId);
    if (set) {
      set.delete(res);
      console.log(`[SSE] Client disconnected for job ${jobId}. Remaining clients: ${set.size}`);
    }
  });
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

// Verify Firebase ID token and attach req.user
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return sendError(req, res, 401, 'AUTH_REQUIRED', 'Missing or invalid Authorization header');
    }
    const idToken = authHeader.split('Bearer ')[1];
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Token verification failed:', error);
    return sendError(req, res, 401, 'AUTH_INVALID', 'Invalid authentication token');
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

const storage = new Storage();
const inputBucketName = process.env.INPUT_BUCKET_NAME || 'reel-banana-35a54.firebasestorage.app';
const outputBucketName = process.env.OUTPUT_BUCKET_NAME || 'reel-banana-35a54.firebasestorage.app';
const renderEngineEnv = (process.env.RENDER_ENGINE || '').toLowerCase();
const falApiKey = process.env.FAL_RENDER_API_KEY || process.env.FAL_API_KEY || process.env.FAL_KEY || null;
// Default to LTX Video for cost savings (96% cheaper than Veo3)
const falRenderModel = process.env.FAL_RENDER_MODEL || 'fal-ai/ltx-video-13b-distilled/image-to-video';
// Premium model for high-quality requests
const falPremiumModel = process.env.FAL_PREMIUM_MODEL || 'fal-ai/veo3/fast/image-to-video';
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

// Get user tier from Firebase token
async function getUserTierFromToken(uid) {
  if (!uid) return 'free';

  try {
    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      const planId = userData.subscription?.planId || userData.plan || 'free';

      // Map common plan names to tiers
      if (planId.includes('pro') || planId.includes('premium') || planId.includes('studio')) {
        return 'premium';
      } else if (planId.includes('plus') || planId.includes('basic')) {
        return 'basic';
      }
    }
  } catch (error) {
    console.error('Error fetching user tier:', error);
  }

  return 'free';
}

// Apple-style automatic configuration based on tier
function getAutomaticConfig(tier, scenes, hasAudio) {
  const configs = {
    free: {
      aspectRatio: '9:16', // Mobile-first for free users
      resolution: { width: 720, height: 1280 },
      maxDuration: 30,
      maxScenes: 3,
      captions: true,
      useFal: true,
      model: 'ltx-video', // Fast & cheap
      mobileOptimized: true,
      quality: 'standard'
    },
    basic: {
      aspectRatio: '9:16', // Still mobile-first
      resolution: { width: 1080, height: 1920 },
      maxDuration: 60,
      maxScenes: 5,
      captions: true,
      useFal: true,
      model: 'ltx-video',
      mobileOptimized: true,
      quality: 'standard'
    },
    premium: {
      aspectRatio: '16:9', // Cinema-first for premium
      resolution: { width: 1920, height: 1080 },
      maxDuration: 120,
      maxScenes: 10,
      captions: true,
      useFal: true,
      model: 'veo3', // High quality for premium
      mobileOptimized: false,
      quality: 'premium'
    }
  };

  const config = configs[tier] || configs.free;

  // Smart aspect ratio detection from first scene
  if (scenes && scenes.length > 0 && scenes[0].aspectRatio) {
    config.aspectRatio = scenes[0].aspectRatio;
  }

  // Auto-detect mobile intent
  if (hasAudio && hasAudio.includes('tiktok') || hasAudio.includes('instagram')) {
    config.mobileOptimized = true;
    config.aspectRatio = '9:16';
  }

  return config;
}

// Get audio duration using ffprobe
async function getAudioDuration(audioPath) {
  const ffprobe = require('fluent-ffmpeg').ffprobe;

  return new Promise((resolve, reject) => {
    ffprobe(audioPath, (err, metadata) => {
      if (err) {
        console.error('Error getting audio duration:', err);
        reject(err);
      } else {
        const duration = metadata?.format?.duration || 0;
        console.log(`Audio duration detected: ${duration} seconds`);
        resolve(duration);
      }
    });
  });
}

// Synchronize scene durations with audio
async function synchronizeScenesToAudio(scenes, gsAudioPath, tier) {
  if (!scenes || !Array.isArray(scenes) || scenes.length === 0) return [];

  let audioDuration = 0;

  // Get actual audio duration if available
  if (gsAudioPath) {
    try {
      // Download audio temporarily to check duration
      const parseGs = (gs) => {
        if (!gs || !gs.startsWith('gs://')) return null;
        const rest = gs.substring('gs://'.length);
        const idx = rest.indexOf('/');
        return { bucket: rest.substring(0, idx), name: rest.substring(idx + 1) };
      };

      const parsed = parseGs(gsAudioPath);
      if (parsed) {
        const tempPath = `/tmp/temp_audio_${Date.now()}.mp3`;
        const bucket = storage.bucket(parsed.bucket);
        await bucket.file(parsed.name).download({ destination: tempPath });
        audioDuration = await getAudioDuration(tempPath);

        // Clean up temp file
        try { await fs.unlink(tempPath); } catch {}
      }
    } catch (error) {
      console.error('Error getting audio duration, using fallback:', error);
    }
  }

  // If no audio duration found, estimate based on scenes
  if (!audioDuration) {
    audioDuration = scenes.reduce((sum, s) => sum + (s.duration || 5), 0);
  }

  // Distribute duration evenly across scenes with a small buffer
  const bufferTime = 2; // 2 second buffer to ensure audio doesn't cut off
  const totalVideoDuration = audioDuration + bufferTime;
  const durationPerScene = totalVideoDuration / scenes.length;

  console.log(`Synchronizing ${scenes.length} scenes to ${audioDuration}s audio (${totalVideoDuration}s with buffer)`);

  // Apply tier limits while respecting audio duration
  const limits = {
    free: { maxScenes: 3, maxSceneDuration: 15, maxTotalDuration: 45 },
    basic: { maxScenes: 5, maxSceneDuration: 20, maxTotalDuration: 90 },
    premium: { maxScenes: 10, maxSceneDuration: 30, maxTotalDuration: 180 }
  };

  const limit = limits[tier] || limits.free;

  // Ensure we don't exceed tier limits
  const maxAllowedDuration = Math.min(totalVideoDuration, limit.maxTotalDuration);
  const finalDurationPerScene = Math.min(durationPerScene, limit.maxSceneDuration);

  // Optimize scenes with synchronized durations
  let optimized = scenes.slice(0, limit.maxScenes);

  optimized = optimized.map((scene, i) => {
    // For the last scene, add any remaining duration to ensure full audio coverage
    const isLastScene = i === optimized.length - 1;
    const sceneDuration = isLastScene
      ? Math.max(finalDurationPerScene, maxAllowedDuration - (finalDurationPerScene * (optimized.length - 1)))
      : finalDurationPerScene;

    return {
      ...scene,
      duration: Math.max(3, Math.round(sceneDuration)) // Minimum 3 seconds per scene
    };
  });

  // Log the final durations
  const finalTotalDuration = optimized.reduce((sum, s) => sum + s.duration, 0);
  console.log(`Final video duration: ${finalTotalDuration}s for ${audioDuration}s audio`);

  return optimized;
}

// Optimize scenes based on tier limits (fallback when no audio sync needed)
function optimizeScenes(scenes, tier) {
  if (!scenes || !Array.isArray(scenes)) return [];

  const limits = {
    free: { maxScenes: 3, maxSceneDuration: 15, maxTotalDuration: 45 },
    basic: { maxScenes: 5, maxSceneDuration: 20, maxTotalDuration: 90 },
    premium: { maxScenes: 10, maxSceneDuration: 30, maxTotalDuration: 180 }
  };

  const limit = limits[tier] || limits.free;

  // Limit number of scenes
  let optimized = scenes.slice(0, limit.maxScenes);

  // Optimize durations
  let totalDuration = 0;
  optimized = optimized.map(scene => {
    const duration = Math.min(scene.duration || 5, limit.maxSceneDuration);
    totalDuration += duration;

    // If we're over total limit, reduce this scene
    if (totalDuration > limit.maxTotalDuration) {
      const excess = totalDuration - limit.maxTotalDuration;
      return { ...scene, duration: Math.max(3, duration - excess) };
    }

    return { ...scene, duration };
  });

  // Add smart transitions based on content
  optimized = optimized.map((scene, i) => {
    if (!scene.transition) {
      // Smart transition selection
      if (i === 0) {
        scene.transition = 'fade'; // Always fade in
      } else if (i === optimized.length - 1) {
        scene.transition = 'fade'; // Always fade out
      } else {
        // Alternate between subtle transitions
        scene.transition = i % 2 === 0 ? 'dissolve' : 'fade';
      }
    }
    return scene;
  });

  console.log(`Optimized ${scenes.length} scenes to ${optimized.length} for ${tier} tier`);
  return optimized;
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

    // Smart model selection based on user tier
    let modelId;
    if (modelOverride) {
      modelId = String(modelOverride);
    } else {
      // Get user tier from Firebase ID token if available
      const userTier = req.user?.tier || req.user?.plan || 'free';
      const requestQuality = req.body?.quality || 'standard';

      // Premium users get Veo3 for high quality
      if ((userTier === 'pro' || userTier === 'premium') && requestQuality === 'premium') {
        modelId = falPremiumModel || 'fal-ai/veo3/fast/image-to-video';
        console.log(`Using premium model (Veo3) for ${userTier} user - Cost: ~$1.20 per 8 seconds`);
      } else {
        // Default to LTX for cost savings (96% cheaper)
        modelId = falRenderModel || 'fal-ai/ltx-video-13b-distilled/image-to-video';
        console.log(`Using standard model (LTX) for ${userTier} user - Cost: ~$0.04 per 8 seconds`);
      }
    }
    if (!falApiKey) return sendError(req, res, 500, 'CONFIG', 'FAL_API_KEY is not configured');
    if (!modelId) return sendError(req, res, 500, 'CONFIG', 'FAL_RENDER_MODEL is not configured');

    // Find scene image in input bucket
    const sceneInputBucket = storage.bucket(inputBucketName);
    const [files] = await sceneInputBucket.getFiles({ prefix: `${projectId}/scene-${sceneIndex}-` });
    const first = files && files[0];
    if (!first) return sendError(req, res, 404, 'NOT_FOUND', `No image found for scene ${sceneIndex}`);
    const [signedUrl] = await sceneInputBucket.file(first.name).getSignedUrl({ version: 'v4', action: 'read', expires: Date.now() + 60*60*1000 });

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
      'fal-ai/ltx-video-13b-distilled/image-to-video'
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
          // progress polling inside generate-clip; omit SSE in this endpoint
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

    // Download and persist to clips folder in main bucket (private)
    const clipInputBucket = storage.bucket(inputBucketName);
    const clipPath = `${projectId}/clips/scene-${sceneIndex}.mp4`;
    const file = clipInputBucket.file(clipPath);
    const remote = await fetch(outUrl);
    if (!remote.ok) return sendError(req, res, 500, 'FAL_DOWNLOAD_FAILED', `HTTP ${remote.status}`);
    const buf = Buffer.from(await remote.arrayBuffer());
    await file.save(buf, { metadata: { contentType: 'video/mp4' } });
    try { await file.makePublic(); } catch (e) { console.warn('makePublic failed for generate-clip', clipPath, e?.message || e); }
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
app.post('/render',
  verifyToken,
  requireCredits('videoRendering', (req) => ({ sceneCount: req.body.scenes?.length || 0 })),
  deductCreditsAfter('videoRendering', (req) => ({ sceneCount: req.body.scenes?.length || 0 })),
  ...createExpensiveOperationLimiter('render'),
  appCheckOrAdmin,
  async (req, res) => {
    const renderStartTime = Date.now();
    let { projectId, scenes, gsAudioPath, srtPath, gsMusicPath, useFal, force, targetW, targetH, aspectRatio, exportPreset, noSubtitles, mobileReel } = req.body;
    const jobId = (req.body && req.body.jobId) ? String(req.body.jobId) : `render-${projectId}-${Date.now()}`;

    if (!projectId) {
        return sendError(req, res, 400, 'INVALID_ARGUMENT', 'Missing required field: projectId');
    }

    // Get user tier for automatic configuration
    const userTier = await getUserTierFromToken(req.user?.uid);
    console.log(`User tier detected: ${userTier}`);

    // Apple-style automatic configuration based on tier
    const autoConfig = getAutomaticConfig(userTier, scenes, gsAudioPath);

    // Apply automatic settings (can be overridden by explicit params)
    if (!aspectRatio) aspectRatio = autoConfig.aspectRatio;
    if (!targetW) targetW = autoConfig.resolution.width;
    if (!targetH) targetH = autoConfig.resolution.height;
    if (noSubtitles === undefined) noSubtitles = !autoConfig.captions;
    if (useFal === undefined) useFal = autoConfig.useFal;

    // Auto-generate music if no audio provided (Apple-style: just works)
    if (!gsAudioPath && !gsMusicPath) {
      req.body.autoGenerateMusic = true;
      console.log('No audio provided - will auto-generate music');
    }

    // Smart scene optimization with audio synchronization
    if (gsAudioPath) {
      // Synchronize scenes to audio duration
      scenes = await synchronizeScenesToAudio(scenes, gsAudioPath, userTier);
    } else {
      // Use standard optimization when no audio
      scenes = optimizeScenes(scenes, userTier);
    }
    req.body.scenes = scenes;

    // Mobile detection and optimization
    let isMobileFastPath = mobileReel || autoConfig.mobileOptimized;
    if (isMobileFastPath) {
      console.log('📱 Mobile optimization activated');
      req.body.aspectRatio = '9:16';
      req.body.targetW = 720;
      req.body.targetH = 1280;
      req.body.useFal = true;
      req.body.noSubtitles = false; // Keep captions for mobile - they're essential
    }

    console.log(`Received render request for projectId: ${projectId}${isMobileFastPath ? ' [MOBILE FAST PATH]' : ''}`);
    try {
      const dbg = {
        hasScenes: Array.isArray(scenes),
        sceneCount: Array.isArray(scenes) ? scenes.length : 0,
        hasAudioPath: typeof gsAudioPath === 'string' && gsAudioPath.startsWith('gs://'),
        hasSrtPath: typeof srtPath === 'string' && srtPath.startsWith('gs://'),
        noSubtitles: !!noSubtitles,
        useFal,
        mobileReel: isMobileFastPath,
      };
      console.log('Render debug:', dbg);
    } catch (_) {}
    try { await pushProgress(jobId, { progress: 1, stage: 'initializing', message: isMobileFastPath ? '📱 Starting mobile reel…' : 'Starting render…' }); } catch {}

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
        
        // Use FAL for per-scene clip generation + FFmpeg compose for assembly
        // This approach: 1) Generate 8s clips per scene with FAL, 2) Compose final video with FAL FFmpeg API
        const useFalEngine = (typeof useFal === 'boolean') ? !!useFal : false;
        console.log(`Render engine selected: ${useFalEngine ? 'FAL (per-scene + compose)' : 'FFmpeg'} (env=${renderEngineEnv}, body.useFal=${useFal}, duration=${totalDuration}s, scenes=${(scenes || []).length})`);
        
        if (useFalEngine) {
            if (!falApiKey) {
                return sendError(req, res, 500, 'CONFIG', 'FAL_API_KEY is not configured');
            }
            if (!falRenderModel) {
                return sendError(req, res, 500, 'CONFIG', 'FAL_RENDER_MODEL is not configured');
            }

            // FAL Per-Scene + Compose Approach
            // 1. Generate 8-second clips for each scene using FAL
            // 2. Use FAL's FFmpeg compose API to merge clips with audio/captions
            
            if (!scenes || !gsAudioPath || !srtPath) {
                return sendError(req, res, 400, 'INVALID_ARGUMENT', 'Missing required fields for rendering.');
            }

            console.log(`FAL per-scene approach: generating ${scenes.length} clips, then composing final video`);
            const totalScenes = scenes.length;
            let perSceneMap = {};
            await pushProgress(jobId, { progress: 10, stage: 'clips', message: `Generating ${totalScenes} motion clips…`, perScene: perSceneMap, sceneCount: totalScenes, currentScene: 0 });

            // Step 1: Generate clips for each scene
            const { fal } = await import('@fal-ai/client');
            fal.config({ credentials: falApiKey });
            
            const outputBucket = storage.bucket(outputBucketName); // Public bucket for final videos
            const inputBucket = storage.bucket(inputBucketName); // Main bucket for clips and assets
            const clipUrls = [];
            
            for (let i = 0; i < scenes.length; i++) {
                console.log(`Checking for existing clip for scene ${i}...`);
                const pct = Math.min(75, 10 + Math.round(((i) / Math.max(1, totalScenes)) * 60));
                perSceneMap[i] = perSceneMap[i] || 5;
                await pushProgress(jobId, { progress: pct, stage: 'clips', message: `Scene ${i+1}/${totalScenes}: preparing…`, perScene: { [i]: perSceneMap[i] }, currentScene: i });
                
                // Check if clip already exists in input bucket (main bucket) - clips stay private
                const clipFileName = `${projectId}/clips/scene-${i}.mp4`;
                const existingClip = inputBucket.file(clipFileName);
                const [exists] = await existingClip.exists();
                
                if (exists && !force) {
                    console.log(`✅ Using cached clip for scene ${i}: ${clipFileName}`);
                    // Get signed URL for existing clip
                    const [signedClipUrl] = await existingClip.getSignedUrl({ 
                        version: 'v4', 
                        action: 'read', 
                        expires: Date.now() + 60*60*1000 
                    });
                    clipUrls.push(signedClipUrl);
                    perSceneMap[i] = 100;
                    await pushProgress(jobId, { progress: pct, stage: 'clips', message: `Scene ${i+1}/${totalScenes}: cached`, perScene: { [i]: 100 }, currentScene: i });
                    continue;
                }
                
                console.log(`Generating new clip for scene ${i}...`);
                
                // Find scene image
                const [files] = await inputBucket.getFiles({ prefix: `${projectId}/scene-${i}-` });
                const first = files && files[0];
                if (!first) {
                    console.warn(`No image found for scene ${i}, skipping`);
                    continue;
                }
                
                // Get signed URL for image
                const [signedUrl] = await inputBucket.file(first.name).getSignedUrl({ 
                    version: 'v4', 
                    action: 'read', 
                    expires: Date.now() + 60*60*1000 
                });
                
                // Select model based on tier
                const clipModel = userTier === 'premium' && autoConfig.quality === 'premium'
                    ? falPremiumModel
                    : falRenderModel;

                // Generate clip using FAL
                const falInput = {
                    prompt: scenes[i].prompt || 'Cinematic parallax over UI; subtle camera motion; modern tech vibe.',
                    image_url: signedUrl,
                    duration: Math.min(8, scenes[i].duration || 8), // Use scene duration if specified
                    seconds: Math.min(8, scenes[i].duration || 8),
                    video_length: Math.min(8, scenes[i].duration || 8)
                };

                console.log(`Generating clip ${i+1} with ${clipModel === falPremiumModel ? 'Veo3 (premium)' : 'LTX (standard)'}`);

                try {
                    const result = await fal.subscribe(clipModel, { input: falInput, logs: false });
                    const clipUrl = pickUrl(result?.data);
                    if (!clipUrl) {
                        throw new Error('FAL did not return a video URL');
                    }
                    
                    // Download and save clip to input bucket (main bucket) for caching
                    const clipResponse = await fetch(clipUrl);
                    if (!clipResponse.ok) {
                        throw new Error(`Failed to download generated clip: ${clipResponse.status}`);
                    }
                    const clipBuffer = await clipResponse.arrayBuffer();
                    await existingClip.save(Buffer.from(clipBuffer), { 
                        metadata: { contentType: 'video/mp4' }
                    });
                    try { await existingClip.makePublic(); } catch (e) { console.warn('makePublic failed for cached clip', clipFileName, e?.message || e); }
                    console.log(`💾 Cached clip for scene ${i}: ${clipFileName} (public)`);
                    
                    // Use the cached clip URL
                    const [signedClipUrl] = await existingClip.getSignedUrl({ 
                        version: 'v4', 
                        action: 'read', 
                        expires: Date.now() + 60*60*1000 
                    });
                    clipUrls.push(signedClipUrl);
                    perSceneMap[i] = 100;
                    await pushProgress(jobId, { progress: Math.min(75, 10 + Math.round(((i+1) / Math.max(1, totalScenes)) * 60)), stage: 'clips', message: `Scene ${i+1}/${totalScenes}: complete`, perScene: { [i]: 100 }, currentScene: i });
                    console.log(`Scene ${i} clip generated and cached: ${signedClipUrl}`);
                } catch (e) {
                    console.error(`Failed to generate clip for scene ${i}:`, e?.message || e);
                    return sendError(req, res, 500, 'FAL_CLIP_FAILURE', `Failed to generate clip for scene ${i}`, e?.message || String(e));
                }
            }
            
            if (clipUrls.length === 0) {
                return sendError(req, res, 500, 'FAL_CLIP_FAILURE', 'No clips were generated');
            }
            
            // Step 2: Compose final video using FFmpeg (fallback approach)
            console.log(`Composing final video from ${clipUrls.length} clips using FFmpeg...`);
            
            // Download clips and compose with FFmpeg locally
            tempDir = path.join('/tmp', projectId);
            await fs.mkdir(tempDir, { recursive: true });
            
            // Download all clips
            const clipPaths = [];
            for (let i = 0; i < clipUrls.length; i++) {
                const clipPath = path.join(tempDir, `clip-${i}.mp4`);
                const response = await fetch(clipUrls[i]);
                if (!response.ok) {
                    throw new Error(`Failed to download clip ${i}: ${response.status}`);
                }
                const arrayBuffer = await response.arrayBuffer();
                await fs.writeFile(clipPath, Buffer.from(arrayBuffer));
                clipPaths.push(clipPath);
                console.log(`Downloaded clip ${i}: ${clipPath}`);
            }
            
            // Get audio files
            const parseGs = (gs) => {
                if (!gs || !gs.startsWith('gs://')) return null;
                const rest = gs.substring('gs://'.length);
                const firstSlash = rest.indexOf('/');
                return { bucket: rest.substring(0, firstSlash), path: rest.substring(firstSlash + 1) };
            };
            
            const audioObj = parseGs(gsAudioPath);
            const musicObj = gsMusicPath ? parseGs(gsMusicPath) : null;
            
            const audioPath = path.join(tempDir, 'narration.mp3');
            const musicPath = path.join(tempDir, 'music.mp3');
            
            // Download narration audio
            if (audioObj) {
                const audioFile = storage.bucket(audioObj.bucket).file(audioObj.path);
                await audioFile.download({ destination: audioPath });
                console.log(`Downloaded narration: ${audioPath}`);
            }
            
            // Download music if available
            if (musicObj) {
                const musicFile = storage.bucket(musicObj.bucket).file(musicObj.path);
                await musicFile.download({ destination: musicPath });
                console.log(`Downloaded music: ${musicPath}`);
            }
            
            // Create concat list for FFmpeg
            const concatListPath = path.join(tempDir, 'concat_list.txt');
            const concatList = clipPaths.map(clipPath => `file '${clipPath}'`).join('\n');
            await fs.writeFile(concatListPath, concatList);
            
            // Concatenate video clips
            const silentVideoPath = path.join(tempDir, 'silent_video.mp4');
            const attemptConcat = (copyMode) => new Promise((resolve, reject) => {
                const cmd = ffmpeg()
                  .input(concatListPath)
                  .inputOptions(['-f', 'concat', '-safe', '0']);
                if (copyMode) {
                  cmd.outputOptions(['-c', 'copy']);
                } else {
                  cmd.outputOptions(['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast', '-crf', '23']);
                }
                cmd
                  .on('start', (cli) => console.log(`FFmpeg concat start (copyMode=${copyMode}):`, cli))
                  .on('stderr', (line) => { try { if (process.env.FFMPEG_LOG_LEVEL !== 'quiet') console.log('ffmpeg:', line); } catch {} })
                  .on('end', resolve)
                  .on('error', (err) => {
                    console.error(`FFmpeg concat error (copyMode=${copyMode}):`, err?.message || err);
                    reject(err);
                  })
                  .save(silentVideoPath);
            });

            try {
              await attemptConcat(true);
            } catch (e) {
              console.warn('Concat with -c copy failed, retrying with transcode…');
              try {
                await attemptConcat(false);
              } catch (e2) {
                console.error('FFmpeg concat transcode fallback failed:', e2?.message || e2);
                throw new Error('FFMPEG_FAILURE');
              }
            }
            
            // Add audio to the video with proper synchronization
            const finalVideoPath = path.join(tempDir, 'final_video.mp4');
            const audioInputs = [silentVideoPath];
            const audioFilters = [];
            
            // Calculate total video duration (8 seconds per clip)
            const totalVideoDuration = clipUrls.length * 8;
            console.log(`Total video duration: ${totalVideoDuration} seconds`);
            
            if (await fs.access(audioPath).then(() => true).catch(() => false)) {
                audioInputs.push(audioPath);
                // Trim narration to match video duration and add fade out
                audioFilters.push(`[1:a]atrim=0:${totalVideoDuration},afade=t=out:st=${Math.max(0, totalVideoDuration-1)}:d=1,volume=1.0[audio1]`);
            }
            
            if (await fs.access(musicPath).then(() => true).catch(() => false)) {
                audioInputs.push(musicPath);
                // Trim music to match video duration and add fade out
                audioFilters.push(`[2:a]atrim=0:${totalVideoDuration},afade=t=out:st=${Math.max(0, totalVideoDuration-1)}:d=1,volume=0.3[audio2]`);
            }
            
            if (audioFilters.length > 0) {
                // Mix or pass-through audio tracks
                const haveNarr = audioFilters.some(f => /\[audio1\]$/.test(f));
                const haveMusic = audioFilters.some(f => /\[audio2\]$/.test(f));
                const finalLabel = (haveNarr && !haveMusic) ? 'audio1' : (!haveNarr && haveMusic) ? 'audio2' : 'audio';
                if (haveNarr && haveMusic) {
                  audioFilters.push('[audio1][audio2]amix=inputs=2:duration=first:dropout_transition=2[audio]');
                }
                await new Promise((resolve, reject) => {
                    const command = ffmpeg();
                    audioInputs.forEach(input => command.input(input));
                    command
                        .complexFilter(audioFilters)
                        .outputOptions(['-map', '0:v', '-map', `[${finalLabel}]`, '-c:v', 'copy', '-c:a', 'aac', '-shortest'])
                        .on('start', (cli) => console.log('FFmpeg mux start:', cli))
                        .on('stderr', (line) => { try { if (process.env.FFMPEG_LOG_LEVEL !== 'quiet') console.log('ffmpeg:', line); } catch {} })
                        .on('end', resolve)
                        .on('error', (err) => {
                            console.error('FFmpeg audio mux error:', err?.message || err);
                            reject(new Error('FFMPEG_FAILURE'));
                        })
                        .save(finalVideoPath);
                });
            } else {
                // No audio, just copy the video
                await fs.copyFile(silentVideoPath, finalVideoPath);
            }
            
            // Upload final video to GCS
            pushProgress(jobId, { progress: 90, stage: 'uploading', message: 'Uploading final video…' });
            const finalVideoFile = outputBucket.file(`${projectId}/movie.mp4`);
            const videoBuffer = await fs.readFile(finalVideoPath);
            await finalVideoFile.save(videoBuffer, { 
                metadata: { contentType: 'video/mp4' }
            });
            
            // Return appropriate URL
            let videoUrl;
            if (req.body.published) {
                try {
                    await finalVideoFile.makePublic();
                } catch (_) {}
                videoUrl = finalVideoFile.publicUrl();
            } else {
                const [signedUrl] = await finalVideoFile.getSignedUrl({
                    version: 'v4',
                    action: 'read',
                    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
                });
                videoUrl = signedUrl;
            }
            
            console.log(`FAL per-scene + FFmpeg compose complete: ${videoUrl}`);
            pushProgress(jobId, { progress: 100, stage: 'done', message: 'Done', done: true });
            
            // Record successful render
            const renderDuration = Date.now() - renderStartTime;
            req.sliMonitor.recordSuccess('render', true, { projectId, cached: false, engine: 'fal-per-scene-ffmpeg' });
            req.sliMonitor.recordLatency('render', renderDuration, { projectId, cached: false, engine: 'fal-per-scene-ffmpeg' });
            
            // Complete credit operation
            if (req.creditDeduction?.idempotencyKey) {
                await completeCreditOperation(req.creditDeduction.idempotencyKey, 'completed');
            }
            
            return res.status(200).json({ videoUrl, engine: 'fal-per-scene-ffmpeg', skipPolish: true });
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
            
            // Complete credit operation
            if (req.creditDeduction?.idempotencyKey) {
                await completeCreditOperation(req.creditDeduction.idempotencyKey, 'completed');
            }
            
            try { pushProgress((req.body && req.body.jobId) || `render-${projectId}`, { progress: 100, stage: 'done', message: 'Cached video', done: true }); } catch(_) {}
            return res.status(200).json({ videoUrl, cached: true });
        }

        // Validate required fields for a fresh render only if no cached video exists
        const missingScenes = !Array.isArray(scenes) || scenes.length === 0;
        const missingAudio = !gsAudioPath || typeof gsAudioPath !== 'string' || !gsAudioPath.startsWith('gs://');
        const missingSubs = (!srtPath || typeof srtPath !== 'string' || !srtPath.startsWith('gs://')) && !noSubtitles;
        if (missingScenes || missingAudio || missingSubs) {
            const details = {
              missing: {
                scenes: missingScenes,
                gsAudioPath: missingAudio,
                srtPath: missingSubs && !noSubtitles,
              },
              note: 'Set noSubtitles=true to bypass SRT when captions are unavailable.'
            };
            console.warn('Render validation failed:', details);
            return sendError(req, res, 400, 'INVALID_ARGUMENT', 'Missing required fields for rendering.', JSON.stringify(details));
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
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    // Use subscription.planId if available, otherwise fall back to plan field
                    const planId = userData.subscription?.planId || userData.plan;
                    plan = mapPlanIdToTier(planId);
                }
            }
        } catch (e) {
            console.warn('Render plan lookup failed; defaulting to free');
        }
        
        // Use provided targetW/targetH if available, otherwise fall back to plan-based resolution
        let finalTargetW, finalTargetH;
        if (targetW && targetH) {
            // Clamp provided resolution to plan limits
            const PLAN_RES = { free: { w: 854, h: 480 }, plus: { w: 1280, h: 720 }, pro: { w: 1920, h: 1080 }, studio: { w: 3840, h: 2160 } };
            const planLimits = PLAN_RES[plan] || PLAN_RES.free;
            
            // Maintain aspect ratio while clamping to plan limits
            const aspectRatio = targetW / targetH;
            
            if (targetW > planLimits.w) {
                finalTargetW = planLimits.w;
                finalTargetH = Math.round(finalTargetW / aspectRatio);
            } else {
                finalTargetW = targetW;
                finalTargetH = targetH;
            }
            
            if (finalTargetH > planLimits.h) {
                finalTargetH = planLimits.h;
                finalTargetW = Math.round(finalTargetH * aspectRatio);
            }
            
            console.log(`Using provided resolution: ${finalTargetW}x${finalTargetH} (clamped from ${targetW}x${targetH} for plan: ${plan})`);
        } else {
            // Fall back to plan-based resolution
            const PLAN_RES = { free: { w: 854, h: 480 }, plus: { w: 1280, h: 720 }, pro: { w: 1920, h: 1080 }, studio: { w: 3840, h: 2160 } };
            const { w, h } = PLAN_RES[plan] || PLAN_RES.free;
            finalTargetW = w;
            finalTargetH = h;
            console.log(`Using plan-based resolution: ${finalTargetW}x${finalTargetH} for plan: ${plan}`);
        }

        // Get preset-specific FFmpeg encoding options
        function getPresetEncodingOptions(preset) {
            const baseOptions = ['-c:v libx264', '-pix_fmt yuv420p', '-movflags +faststart'];
            
            switch (preset) {
                case 'youtube':
                    return [...baseOptions, '-preset slow', '-crf 18', '-profile:v high', '-level 4.1', '-b:v 8000k', '-maxrate 10000k', '-bufsize 20000k'];
                case 'tiktok':
                    return [...baseOptions, '-preset medium', '-crf 20', '-profile:v main', '-level 4.0', '-b:v 5000k', '-maxrate 6000k', '-bufsize 12000k'];
                case 'square':
                    return [...baseOptions, '-preset medium', '-crf 22', '-profile:v main', '-level 3.1', '-b:v 4000k', '-maxrate 5000k', '-bufsize 10000k'];
                case 'custom':
                default:
                    return [...baseOptions, '-preset medium', '-crf 22'];
            }
        }
        
        const videoEncodingOptions = getPresetEncodingOptions(exportPreset);
        console.log(`Using encoding options for preset '${exportPreset}':`, videoEncodingOptions);

        // Compute global render cache key (manifest)
        const cacheInputBucket = storage.bucket(inputBucketName);
        const listImages = (await cacheInputBucket.getFiles({ prefix: `${projectId}/scene-` }))[0];
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
        const audioMd5 = await getMd5(cacheInputBucket.file(remoteAudio));
        const captionsMd5 = await getMd5(cacheInputBucket.file(`${projectId}/captions.srt`));
        let musicRel = null, musicMd5 = '';
        if (gsMusicPath) {
            const prefixMusic = `gs://${inputBucketName}/`;
            if (gsMusicPath.startsWith(prefixMusic)) {
                const rel = gsMusicPath.substring(prefixMusic.length);
                if (rel && rel.includes(projectId + '/')) musicRel = rel; else musicRel = `${projectId}/music.wav`;
            } else {
                musicRel = `${projectId}/music.wav`;
            }
            musicMd5 = await getMd5(cacheInputBucket.file(musicRel));
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
            resolution: { w: finalTargetW, h: finalTargetH },
            aspectRatio: aspectRatio || null,
            exportPreset: exportPreset || null,
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
            // Complete credit operation
            if (req.creditDeduction?.idempotencyKey) {
                await completeCreditOperation(req.creditDeduction.idempotencyKey, 'completed');
            }
            
            return res.status(200).json({ videoUrl: videoUrlCached, cached: true });
        }

        // 1. Setup: Create a temporary local directory for processing
        await fs.mkdir(tempDir, { recursive: true });

        // Initialize storage bucket
        const ffmpegInputBucket = storage.bucket(inputBucketName);

        // 2. Download all necessary assets from GCS
        console.log('Downloading assets...');
        const imageFiles = (await ffmpegInputBucket.getFiles({ prefix: `${projectId}/scene-` }))[0];
        
        console.log(`Found ${imageFiles.length} image files:`, imageFiles.map(f => f.name));
        
        // Debug: Also check for any files in the project directory
        const allProjectFiles = (await ffmpegInputBucket.getFiles({ prefix: `${projectId}/` }))[0];
        console.log(`All project files (${allProjectFiles.length}):`, allProjectFiles.map(f => f.name));
        
        // Resolve the correct remote audio and music filenames
        let musicLocalPath = null;
        let narrationLocalPath = path.join(tempDir, 'narration.mp3');
        
        // Use the remoteAudio path already resolved above
        
        const downloadPromises = [
            ...imageFiles.map(file => file.download({ destination: path.join(tempDir, path.basename(file.name)) })),
            ffmpegInputBucket.file(remoteAudio).download({ destination: narrationLocalPath }),
            ffmpegInputBucket.file(`${projectId}/captions.srt`).download({ destination: path.join(tempDir, 'captions.srt') }),
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
                downloadPromises.push(ffmpegInputBucket.file(remoteMusic).download({ destination: musicLocalPath }));
            } catch (_) {
                // Fallback: try both WAV and MP3
                try {
                    musicLocalPath = path.join(tempDir, 'music.wav');
                    downloadPromises.push(ffmpegInputBucket.file(`${projectId}/music.wav`).download({ destination: musicLocalPath }));
                } catch (__) {
                musicLocalPath = path.join(tempDir, 'music.mp3');
                downloadPromises.push(ffmpegInputBucket.file(`${projectId}/music.mp3`).download({ destination: musicLocalPath }));
                }
            }
        }
        
        await Promise.all(downloadPromises);
        console.log('Asset download complete.');

        // Default: auto-generate per-scene motion clips with FAL if missing
        try {
          // Make this behavior default; allow callers to opt-out with autoGenerateClips:false
          let wantAutoClips = true;
          if (req.body && req.body.autoGenerateClips === false) wantAutoClips = false;
          // Use tier-based model selection for auto-clips
          const modelForClips = (req.body && (req.body.clipModel || req.body.clipModelOverride)) ||
            (userTier === 'premium' && autoConfig.quality === 'premium' ? falPremiumModel : falRenderModel);
          if (wantAutoClips && falApiKey && modelForClips.includes('image-to-video')) {
            console.log(`Auto-generating missing motion clips via FAL (${modelForClips === falPremiumModel ? 'Veo3 premium' : 'LTX standard'})...`);
            const autoInputBucket = storage.bucket(inputBucketName);
            const outBucket = storage.bucket(outputBucketName);
            const forceClips = !!(req.body && req.body.forceClips);
            const maxConcurrency = Math.max(1, parseInt(String(req.body?.clipConcurrency || process.env.FAL_CLIP_CONCURRENCY || '2'), 10));

            const tasks = (scenes || []).map((_, i) => async () => {
              try {
                const clipFile = outBucket.file(`${projectId}/clips/scene-${i}.mp4`);
                const [exists] = await clipFile.exists();
                if (exists && !forceClips) return;
                const sceneImage = imageFiles.find(f => path.basename(f.name).startsWith(`scene-${i}-`));
                if (!sceneImage) { console.warn(`auto-clips: no image for scene ${i}`); return; }
                const [signedUrl] = await autoInputBucket.file(sceneImage.name).getSignedUrl({ version: 'v4', action: 'read', expires: Date.now() + 60*60*1000 });
                const secs = Math.max(2, parseInt(String((scenes[i]?.duration) || req.body?.clipSeconds || process.env.FAL_IMAGE_TO_VIDEO_SECONDS || '8'), 10));

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
                const clipDest = `${projectId}/clips/scene-${i}.mp4`;
                await outBucket.upload(localClip, { destination: clipDest, metadata: { contentType: 'video/mp4' } });
                try { await outBucket.file(clipDest).makePublic(); } catch (e) { console.warn('makePublic failed for clip', clipDest, e?.message || e); }
                console.log(`Saved clip for scene ${i} (${secs}s) and made public`);
              } catch (e) {
                console.warn(`auto-clips: failed for scene ${i}:`, e?.message || e);
              }
            });

            // Run with limited concurrency
            const workers = Array.from({ length: Math.min(maxConcurrency, tasks.length) }, async () => {
              for (;;) {
                const next = tasks.shift();
                if (!next) break;
                await next();
              }
            });
            await Promise.all(workers);
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
        const clipLocalPaths = await Promise.all((scenes || []).map(async (_, i) => { try { const clipFile=ffmpegInputBucket.file(`${projectId}/clips/scene-${i}.mp4`); const [ex]=await clipFile.exists(); if(!ex) return null; const local=path.join(tempDir,`clip_${i}.mp4`); await clipFile.download({ destination: local }); return local; } catch { return null; } }));
        const localFirstImages = await Promise.all((scenes || []).map(async (_, i) => { try { const c=imageFiles.filter(f=>path.basename(f.name).startsWith(`scene-${i}-`)); if(!c.length) return null; const first=c[0]; const local=path.join(tempDir, path.basename(first.name)); try { await fs.stat(local); } catch { await ffmpegInputBucket.file(first.name).download({ destination: local }); } return local; } catch { return null; } }));

        // Create per-scene silent MP4s with optional burnt-in scene captions
        const partPaths = [];
        const wantSubs = !(req.body && req.body.noSubtitles === true);
        for (let i=0;i<(scenes||[]).length;i++){
          const scene=scenes[i]; const duration=Math.max(1,scene?.duration||3); const offset=sceneOffsets[i]||0; const end=offset+duration;
          const segEntries = wantSubs ? fullEntries.filter(e=>e.end>offset && e.start<end).map(e=>({ start: Math.max(0,e.start-offset), end: Math.max(0.01, Math.min(duration, e.end-offset)), text: e.text })) : [];
          const segSrtPath = path.join(tempDir, `scene_${i}.srt`); if (wantSubs) { try { await fs.writeFile(segSrtPath, formatSrt(segEntries), 'utf8'); } catch {} }
          const inputClip = clipLocalPaths[i]; const inputImage = localFirstImages[i]; const partOut = path.join(tempDir, `part_${i}.mp4`);

          const buildPart = async (includeSubs) => new Promise((resolve,reject)=>{
            const cmd=ffmpeg(); let vf=`format=yuv420p,scale=${finalTargetW}:${finalTargetH}`;
            if (inputClip) { cmd.input(inputClip).inputOptions([`-t ${duration}`]); }
            else if (inputImage) {
              cmd.input(inputImage).inputOptions(['-loop 1', `-t ${duration}`]);
              switch (scene.camera||'static'){
                case 'zoom-in': vf=`zoompan=z='min(zoom+0.001,1.3)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${finalTargetW}x${finalTargetH},format=yuv420p`; break;
                case 'zoom-out': vf=`zoompan=z='if(lte(zoom,1.0),1.3,max(1.001,zoom-0.001))':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${finalTargetW}x${finalTargetH},format=yuv420p`; break;
                case 'pan-left': vf=`zoompan=z='1.1':d=1:x='iw/2-(iw/zoom/2)-50*sin(t)':y='ih/2-(ih/zoom/2)':s=${finalTargetW}x${finalTargetH},format=yuv420p`; break;
                case 'pan-right': vf=`zoompan=z='1.1':d=1:x='iw/2-(iw/zoom/2)+50*sin(t)':y='ih/2-(ih/zoom/2)':s=${finalTargetW}x${finalTargetH},format=yuv420p`; break;
                default: vf=`scale=${finalTargetW}:${finalTargetH},format=yuv420p`;
              }
            } else { cmd.input(`color=black:s=${finalTargetW}x${finalTargetH}:r=30`).inputOptions(['-f lavfi', `-t ${duration}`]); vf='format=yuv420p'; }
            let fullVf = vf;
            if (includeSubs && segEntries.length > 0) {
              const style = `force_style='Fontsize=18,PrimaryColour=&HFFFFFF&,OutlineColour=&H000000&,BorderStyle=3,Outline=1,Shadow=1,MarginV=25'`;
              fullVf = `${vf},subtitles='${segSrtPath.replace(/'/g, "'\\''")}:${style}`;
            }
            if (plan==='free'){ fullVf+=",drawtext=text='ReelBanana':fontcolor=white@0.6:fontsize=24:box=1:boxcolor=black@0.4:boxborderw=5:x=w-tw-10:y=h-th-10"; }
            console.log(`FFmpeg part ${i} filters:`, fullVf);
            cmd.videoFilters(fullVf)
              .outputOptions(['-an', ...videoEncodingOptions])
              .on('start', (cli)=>console.log(`FFmpeg part ${i} start:`, cli))
              .on('stderr', (line)=>{ try { if (process.env.FFMPEG_LOG_LEVEL!=='quiet') console.log(`ffmpeg part ${i}:`, line); } catch {} })
              .on('end', resolve)
              .on('error', (err)=>{ console.error(`FFmpeg part ${i} error:`, err?.message || err); reject(err); })
              .save(partOut);
          });

          try {
            await buildPart(true);
          } catch (e1) {
            console.warn(`Part ${i} with subtitles failed, retrying without subtitles…`);
            try {
              await buildPart(false);
            } catch (e2) {
              console.error(`Part ${i} fallback without subtitles failed:`, e2?.message || e2);
              throw new Error('FFMPEG_FAILURE');
            }
          }
          partPaths.push(partOut);
        }

        // Concatenate parts (silent)
        const listPath = path.join(tempDir, 'concat_list.txt');
        const listContent = partPaths.map(p=>`file '${p.replace(/'/g, "'\\''")}'`).join('\n');
        await fs.writeFile(listPath, listContent, 'utf8');
        const silentConcatPath = path.join(tempDir, 'video_concat.mp4');
        await new Promise((resolve,reject)=>{
          ffmpeg().input(listPath).inputOptions(['-f concat','-safe 0'])
            .outputOptions(videoEncodingOptions)
            .on('end', resolve)
            .on('error',(err)=>{ console.error('FFmpeg concat error:', err.message); reject(new Error('FFMPEG_FAILURE')); })
            .save(silentConcatPath);
        });

        // Mux audio (narration + optional music with ducking)
        const outputVideoPath = path.join(tempDir, 'final_movie.mp4');
        pushProgress(jobId, { progress: 70, stage: 'composing', message: 'Concatenating scenes…' });
        await new Promise((resolve,reject)=>{
          const cmd=ffmpeg(); cmd.input(silentConcatPath); cmd.input(narrationLocalPath); if (musicLocalPath) cmd.input(musicLocalPath);
          const filterComplex = gsMusicPath
            ? `[${musicLocalPath ? 2 : 1}:a][1:a]sidechaincompress=threshold=0.05:ratio=6:attack=5:release=300[ducked];[ducked][1:a]amix=inputs=2:duration=first:dropout_transition=2,volume=1.0[final_audio]`
            : `[1:a]volume=0.9[final_audio]`;
          cmd.outputOptions(['-map 0:v:0','-map [final_audio]','-filter_complex',filterComplex,'-c:a aac','-b:a 192k','-shortest', ...videoEncodingOptions])
            .on('end', resolve)
            .on('error',(err)=>{ console.error('FFmpeg mux error:', err.message); reject(new Error('FFMPEG_FAILURE')); })
                .save(outputVideoPath);
        });
        pushProgress(jobId, { progress: 85, stage: 'composing', message: 'Mixing audio…' });

        // 4. Upload the final video to the output bucket
        console.log('Uploading final video...');
        pushProgress(jobId, { progress: 92, stage: 'uploading', message: 'Uploading final video…' });
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
        pushProgress(jobId, { progress: 100, stage: 'done', message: 'Done', done: true });
        console.log(`Video uploaded to public bucket for direct access`);
        
        // Record successful fresh render SLI
        const renderDuration = Date.now() - renderStartTime;
        req.sliMonitor.recordSuccess('render', true, { projectId, cached: false });
        req.sliMonitor.recordLatency('render', renderDuration, { projectId, cached: false });
        
        // Complete credit operation
        if (req.creditDeduction?.idempotencyKey) {
            await completeCreditOperation(req.creditDeduction.idempotencyKey, 'completed');
        }
        
        res.status(200).json({ videoUrl });

    } catch (error) {
        console.error(`Error rendering video for projectId ${projectId}:`, error);
        
        // Mark credit operation as failed
        if (req.creditDeduction?.idempotencyKey) {
            await completeCreditOperation(req.creditDeduction.idempotencyKey, 'failed', error.message);
        }
        
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
app.get('/cache-status', appCheckOrAdmin, (req, res) => {
  res.json({
    service: 'render',
    bucket: { input: inputBucketName, output: outputBucketName },
    engine: renderEngineEnv || 'ffmpeg',
    falModel: falRenderModel || null,
    cache: cacheMetrics,
    now: new Date().toISOString(),
  });
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

/**
 * GET /cache-status/:projectId
 * Check what clips are cached for a project
 */
app.get('/cache-status/:projectId', appCheckOrAdmin, async (req, res) => {
    const { projectId } = req.params;
    
    try {
        const statusInputBucket = storage.bucket(inputBucketName);
        const [files] = await statusInputBucket.getFiles({ prefix: `${projectId}/clips/` });
        
        const clips = files.map(file => ({
            name: file.name,
            size: file.metadata.size,
            created: file.metadata.timeCreated,
            updated: file.metadata.updated
        }));
        
        res.json({
            projectId,
            clipsCount: clips.length,
            clips: clips,
            bucket: inputBucketName
        });
    } catch (error) {
        console.error('Cache status error:', error);
        res.status(500).json({
            error: 'Failed to check cache status',
            message: error.message
        });
    }
});

/**
 * GET /signed-clips/:projectId
 * Returns temporary signed URLs for any existing scene clips so the client
 * can probe availability without relying on public ACLs.
 */
app.get('/signed-clips/:projectId', appCheckOrAdmin, async (req, res) => {
  const { projectId } = req.params;
  try {
    const inBucket = storage.bucket(inputBucketName);
    const [files] = await inBucket.getFiles({ prefix: `${projectId}/clips/` });
    const items = [];
    for (const file of files) {
      try {
        const name = String(file.name || '');
        const m = name.match(/clips\/scene-(\d+)\.mp4$/);
        const index = m ? parseInt(m[1], 10) : undefined;
        const [signedUrl] = await file.getSignedUrl({ version: 'v4', action: 'read', expires: Date.now() + 60*60*1000 });
        items.push({ name, url: signedUrl, index });
      } catch (_) {}
    }
    return res.json({ projectId, count: items.length, items });
  } catch (error) {
    console.error('signed-clips error:', error);
    return sendError(req, res, 500, 'INTERNAL', 'Failed to get signed clips', error?.message || String(error));
  }
});

/**
 * GET /cache-status
 * Get overall cache statistics for admin dashboard
 */
app.get('/cache-status', appCheckVerification, async (req, res) => {
    try {
        const outputBucket = storage.bucket(outputBucketName);
        const [files] = await outputBucket.getFiles({ prefix: 'cache/' });
        
        let totalSize = 0;
        let totalFiles = 0;
        const cacheStats = {
            narrate: { hits: 0, misses: 0, size: 0 },
            align: { hits: 0, misses: 0, size: 0 },
            compose: { hits: 0, misses: 0, size: 0 },
            render: { hits: 0, misses: 0, size: 0 }
        };
        
        files.forEach(file => {
            const size = parseInt(file.metadata.size || '0');
            totalSize += size;
            totalFiles++;
            
            // Categorize by service
            if (file.name.includes('cache/narrate/')) {
                cacheStats.narrate.size += size;
            } else if (file.name.includes('cache/align/')) {
                cacheStats.align.size += size;
            } else if (file.name.includes('cache/compose/')) {
                cacheStats.compose.size += size;
            } else if (file.name.includes('cache/render/')) {
                cacheStats.render.size += size;
            }
        });
        
        // Format sizes
        const formatSize = (bytes) => {
            if (bytes === 0) return '0 MB';
            const mb = bytes / (1024 * 1024);
            return `${mb.toFixed(1)} MB`;
        };
        
        const formattedStats = {
            narrate: { ...cacheStats.narrate, size: formatSize(cacheStats.narrate.size) },
            align: { ...cacheStats.align, size: formatSize(cacheStats.align.size) },
            compose: { ...cacheStats.compose, size: formatSize(cacheStats.compose.size) },
            render: { ...cacheStats.render, size: formatSize(cacheStats.render.size) }
        };
        
        res.json({
            totalFiles,
            totalSize: formatSize(totalSize),
            services: formattedStats,
            bucket: outputBucketName
        });
    } catch (error) {
        console.error('Cache status error:', error);
        res.status(500).json({
            error: 'Failed to get cache status',
            message: error.message
        });
    }
});

/**
 * POST /transform-video
 * Transform an existing video using FAL's video processing capabilities
 * Body: {
 *   projectId: string,
 *   sourceVideoUrl?: string,  // URL to source video
 *   gsSourcePath?: string,     // GCS path to source video
 *   transformation: 'upscale' | 'interpolate' | 'stylize' | 'enhance',
 *   style?: string,            // For stylize transformation
 *   targetFps?: number,        // For interpolate transformation
 *   targetResolution?: string  // For upscale transformation
 * }
 */
app.post('/transform-video',
  verifyToken,
  requireCredits('videoRendering', () => ({ sceneCount: 1 })),
  deductCreditsAfter('videoRendering', () => ({ sceneCount: 1 })),
  appCheckOrAdmin,
  async (req, res) => {
    const { projectId, sourceVideoUrl, gsSourcePath, transformation, style, targetFps, targetResolution } = req.body;

    if (!projectId) {
      return sendError(req, res, 400, 'INVALID_ARGUMENT', 'Missing projectId');
    }

    if (!sourceVideoUrl && !gsSourcePath) {
      return sendError(req, res, 400, 'INVALID_ARGUMENT', 'Must provide either sourceVideoUrl or gsSourcePath');
    }

    if (!transformation) {
      return sendError(req, res, 400, 'INVALID_ARGUMENT', 'Missing transformation type');
    }

    console.log(`Starting video transformation: ${transformation} for project ${projectId}`);

    try {
      // Get source video URL
      let videoUrl = sourceVideoUrl;
      if (gsSourcePath) {
        // Generate signed URL for GCS file
        const bucket = storage.bucket(outputBucketName);
        const file = bucket.file(gsSourcePath.replace(`gs://${outputBucketName}/`, ''));
        const [signedUrl] = await file.getSignedUrl({
          version: 'v4',
          action: 'read',
          expires: Date.now() + 60 * 60 * 1000, // 1 hour
        });
        videoUrl = signedUrl;
      }

      // Import FAL client
      const { fal } = await import('@fal-ai/client');
      fal.config({ credentials: falApiKey });

      let result;
      let outputPath;

      switch (transformation) {
        case 'upscale':
          // Use FAL's upscaling model (could be polish service endpoint)
          console.log(`Upscaling video to ${targetResolution || '4K'}`);
          result = await fal.queue.submit('fal-ai/ffmpeg-api/compose', {
            inputs: [{ url: videoUrl, type: 'video' }],
            filters: [{
              type: 'scale',
              width: targetResolution === '4K' ? 3840 : 1920,
              height: targetResolution === '4K' ? 2160 : 1080,
              algorithm: 'lanczos'
            }],
            output_format: 'mp4'
          });
          outputPath = `${projectId}/transformed/upscaled-${Date.now()}.mp4`;
          break;

        case 'interpolate':
          // Frame interpolation for smoother motion
          const fps = targetFps || 60;
          console.log(`Interpolating video to ${fps}fps`);
          result = await fal.queue.submit('fal-ai/ffmpeg-api/compose', {
            inputs: [{ url: videoUrl, type: 'video' }],
            filters: [{
              type: 'minterpolate',
              fps: fps,
              mi_mode: 'mci',
              mc_mode: 'aobmc',
              vsbmc: 1
            }],
            output_format: 'mp4'
          });
          outputPath = `${projectId}/transformed/interpolated-${Date.now()}.mp4`;
          break;

        case 'stylize':
          // Apply artistic style transfer
          console.log(`Applying style: ${style || 'cinematic'}`);
          // This would use a style transfer model if available
          // For now, we'll apply color grading filters
          const styleFilters = {
            'cinematic': { contrast: 1.2, saturation: 0.9, gamma: 1.1 },
            'vintage': { sepia: 0.3, contrast: 1.1, brightness: 0.95 },
            'noir': { saturation: 0, contrast: 1.5, gamma: 0.8 },
            'vibrant': { saturation: 1.5, contrast: 1.1, vibrance: 1.3 }
          };

          const selectedStyle = styleFilters[style] || styleFilters['cinematic'];
          result = await fal.queue.submit('fal-ai/ffmpeg-api/compose', {
            inputs: [{ url: videoUrl, type: 'video' }],
            filters: [
              { type: 'eq', ...selectedStyle }
            ],
            output_format: 'mp4'
          });
          outputPath = `${projectId}/transformed/stylized-${Date.now()}.mp4`;
          break;

        case 'enhance':
          // General enhancement: denoise, sharpen, stabilize
          console.log('Applying video enhancement filters');
          result = await fal.queue.submit('fal-ai/ffmpeg-api/compose', {
            inputs: [{ url: videoUrl, type: 'video' }],
            filters: [
              { type: 'hqdn3d', strength: 4 }, // Denoise
              { type: 'unsharp', amount: 0.5 }, // Sharpen
              { type: 'deshake' } // Stabilize
            ],
            output_format: 'mp4'
          });
          outputPath = `${projectId}/transformed/enhanced-${Date.now()}.mp4`;
          break;

        default:
          return sendError(req, res, 400, 'INVALID_ARGUMENT', `Unknown transformation: ${transformation}`);
      }

      // Wait for processing
      const processedResult = await fal.queue.result(result.request_id);
      const processedVideoUrl = processedResult.output_url || processedResult.video?.url;

      if (!processedVideoUrl) {
        throw new Error('No output URL from transformation');
      }

      // Download and upload to GCS
      const response = await fetch(processedVideoUrl);
      const buffer = await response.buffer();

      const bucket = storage.bucket(outputBucketName);
      const file = bucket.file(outputPath);
      await file.save(buffer, {
        metadata: {
          contentType: 'video/mp4',
          metadata: {
            projectId,
            transformation,
            sourceVideo: gsSourcePath || sourceVideoUrl,
            timestamp: new Date().toISOString()
          }
        }
      });

      // Make public for easy access
      await file.makePublic();
      const publicUrl = file.publicUrl();

      console.log(`Video transformation complete: ${publicUrl}`);

      // Complete credit operation
      if (req.creditDeduction) {
        await completeCreditOperation(req.creditDeduction.idempotencyKey, 'completed');
      }

      res.json({
        success: true,
        videoUrl: publicUrl,
        gsPath: `gs://${outputBucketName}/${outputPath}`,
        transformation,
        metadata: {
          projectId,
          transformation,
          ...(style && { style }),
          ...(targetFps && { targetFps }),
          ...(targetResolution && { targetResolution })
        }
      });

    } catch (error) {
      console.error('Video transformation error:', error);

      // Refund credits on error
      if (req.creditDeduction) {
        await completeCreditOperation(req.creditDeduction.idempotencyKey, 'failed');
      }

      return sendError(req, res, 500, 'INTERNAL', `Transformation failed: ${error.message}`);
    }
  }
);

/**
 * GET /admin/stats
 * Get comprehensive admin statistics
 */
app.get('/admin/stats', appCheckVerification, async (req, res) => {
    try {
        const outputBucket = storage.bucket(outputBucketName);
        const adminInputBucket = storage.bucket(inputBucketName);
        
        // Get video files
        const [videoFiles] = await outputBucket.getFiles({ prefix: '' });
        const videos = videoFiles.filter(f => f.name.endsWith('.mp4'));
        
        // Get project directories
        const projectDirs = new Set();
        videoFiles.forEach(file => {
            const parts = file.name.split('/');
            if (parts.length > 1) {
                projectDirs.add(parts[0]);
            }
        });
        
        // Get input files
        const [inputFiles] = await adminInputBucket.getFiles({ prefix: '' });
        
        // Calculate storage usage
        let totalVideoSize = 0;
        videos.forEach(video => {
            totalVideoSize += parseInt(video.metadata.size || '0');
        });
        
        let totalInputSize = 0;
        inputFiles.forEach(file => {
            totalInputSize += parseInt(file.metadata.size || '0');
        });
        
        const formatSize = (bytes) => {
            if (bytes === 0) return '0 MB';
            const gb = bytes / (1024 * 1024 * 1024);
            return `${gb.toFixed(2)} GB`;
        };
        
        res.json({
            videos: {
                total: videos.length,
                totalSize: formatSize(totalVideoSize),
                averageSize: videos.length > 0 ? formatSize(totalVideoSize / videos.length) : '0 MB'
            },
            projects: {
                total: projectDirs.size,
                active: projectDirs.size // Simplified - in real implementation, check last activity
            },
            storage: {
                videos: formatSize(totalVideoSize),
                inputs: formatSize(totalInputSize),
                total: formatSize(totalVideoSize + totalInputSize)
            },
            services: {
                render: {
                    engine: renderEngineEnv,
                    falModel: falRenderModel,
                    memory: process.env.MEMORY_LIMIT || 'unknown',
                    cpu: process.env.CPU_LIMIT || 'unknown'
                }
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Admin stats error:', error);
        res.status(500).json({
            error: 'Failed to get admin stats',
            message: error.message
        });
    }
});


const PORT = process.env.PORT || 8082;
app.listen(PORT, () => {
  console.log(`Render service listening on port ${PORT}`);
});
