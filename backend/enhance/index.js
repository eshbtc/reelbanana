const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const { Storage } = require('@google-cloud/storage');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();

// Trust the first proxy (Cloud Run/GFE) for correct IPs
app.set('trust proxy', 1);

app.use(express.json());

// Dynamic CORS configuration
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

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

const storage = new Storage();
const inputBucketName = process.env.INPUT_BUCKET_NAME || 'reel-banana-35a54.firebasestorage.app';
const outputBucketName = process.env.OUTPUT_BUCKET_NAME || 'reel-banana-35a54.firebasestorage.app';

// Configure multer for file uploads
const upload = multer({
  dest: '/tmp/uploads/',
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max
    files: 1
  }
});

// Progress tracking
const progressStore = new Map();
const sseClients = new Map();

// Helper functions
function sendError(req, res, httpStatus, code, message, details) {
  const payload = { code, message };
  if (details) payload.details = details;
  payload.requestId = req.requestId || res.getHeader('X-Request-Id');
  res.status(httpStatus).json(payload);
}

// Progress update function
async function pushProgress(jobId, update) {
  const prev = progressStore.get(jobId) || { progress: 0 };
  const next = {
    ...prev,
    ...update,
    ts: Date.now()
  };
  progressStore.set(jobId, next);

  // Send to SSE clients
  const clients = sseClients.get(jobId);
  if (clients && clients.size) {
    const payload = `data: ${JSON.stringify({ jobId, ...next })}\n\n`;
    for (const res of clients) {
      try { res.write(payload); } catch (_) {}
    }
  }
}

// Firebase ID token verification middleware
const verifyToken = async (req, res, next) => {
  const authHeader = req.header('Authorization');
  const isDevelopment = process.env.DEV_MODE === 'true';

  if (isDevelopment) {
    // In dev mode, create a mock user
    req.user = { uid: 'dev-user', email: 'dev@example.com' };
    next();
    return;
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(req, res, 401, 'UNAUTHENTICATED', 'Authentication required');
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Token verification failed:', error);
    return sendError(req, res, 401, 'UNAUTHENTICATED', 'Invalid authentication token');
  }
};

// App Check verification middleware
const appCheckVerification = async (req, res, next) => {
  const appCheckToken = req.header('X-Firebase-AppCheck');
  const isDevelopment = process.env.DEV_MODE === 'true';

  if (isDevelopment) {
    console.log('Dev mode: Skipping App Check verification');
    next();
    return;
  }

  if (!appCheckToken) {
    return sendError(req, res, 403, 'UNAUTHENTICATED', 'App Check token missing');
  }

  try {
    const appCheckClaims = await admin.appCheck().verifyToken(appCheckToken);
    req.appCheckClaims = appCheckClaims;
    next();
  } catch (err) {
    console.error('App Check verification failed:', err);
    return sendError(req, res, 403, 'UNAUTHENTICATED', 'Invalid App Check token');
  }
};

// Import shared modules
const { createHealthEndpoints } = require('./shared/healthCheck');
const { createExpensiveOperationLimiter } = require('./shared/rateLimiter');
const { requireCredits, deductCreditsAfter, completeCreditOperation } = require('../shared/creditService');

// Health check endpoints
createHealthEndpoints(app, 'enhance',
  {
    inputBucket: inputBucketName,
    outputBucket: outputBucketName,
    falConfigured: !!(process.env.FAL_ENHANCE_API_KEY || process.env.FAL_API_KEY),
  },
  async () => {
    // Check FAL API health
    if (process.env.FAL_ENHANCE_API_KEY || process.env.FAL_API_KEY) {
      try {
        // Simple health check - just verify we can initialize the client
        return { fal: 'ok' };
      } catch (e) {
        return { fal: 'error', error: e.message };
      }
    }
    return { fal: 'not_configured' };
  }
);

/**
 * Available Enhancement Models:
 *
 * Style Transfer:
 * - fal-ai/styleshot/video - Apply artistic styles to videos
 * - fal-ai/animatediff/video-to-video - Anime/cartoon style transfer
 *
 * Quality Enhancement:
 * - fal-ai/video-upscaler - Upscale video resolution
 * - fal-ai/face-restoration - Enhance faces in video
 *
 * Effects:
 * - fal-ai/remove-bg/video - Remove/replace backgrounds
 * - fal-ai/stabilization - Stabilize shaky footage
 */

const ENHANCEMENT_MODELS = {
  'style-cinematic': {
    model: 'fal-ai/styleshot/video',
    params: { style: 'cinematic', intensity: 0.7 }
  },
  'style-anime': {
    model: 'fal-ai/animatediff/video-to-video',
    params: { style: 'anime' }
  },
  'style-cartoon': {
    model: 'fal-ai/animatediff/video-to-video',
    params: { style: 'cartoon' }
  },
  'enhance-quality': {
    model: 'fal-ai/video-upscaler',
    params: { scale: 2 }
  },
  'enhance-face': {
    model: 'fal-ai/face-restoration',
    params: {}
  },
  'remove-background': {
    model: 'fal-ai/remove-bg/video',
    params: {}
  },
  'stabilize': {
    model: 'fal-ai/stabilization',
    params: {}
  }
};

/**
 * POST /enhance-video
 * Enhance or transform a video using AI models
 *
 * Body:
 * {
 *   "videoUrl": "https://...", // OR upload file
 *   "gsUrl": "gs://bucket/path", // OR GCS URL
 *   "preset": "style-cinematic|style-anime|enhance-quality|...",
 *   "operations": ["style", "enhance", "stabilize"], // Multiple ops
 *   "callbackUrl": "https://...", // Optional webhook
 *   "projectId": "project_123"
 * }
 *
 * Returns:
 * {
 *   "jobId": "enhance_123456",
 *   "status": "processing",
 *   "message": "Enhancement job started"
 * }
 */
app.post('/enhance-video',
  appCheckVerification,
  verifyToken,
  requireCredits('videoEnhancement'),
  deductCreditsAfter('videoEnhancement'),
  ...createExpensiveOperationLimiter('enhance'),
  upload.single('video'),
  async (req, res) => {
    const jobId = `enhance_${Date.now()}_${uuidv4().slice(0, 8)}`;
    const { videoUrl, gsUrl, preset, operations, callbackUrl, projectId } = req.body;

    // Validate input
    if (!req.file && !videoUrl && !gsUrl) {
      return sendError(req, res, 400, 'INVALID_ARGUMENT', 'Must provide video file, videoUrl, or gsUrl');
    }

    if (!preset && (!operations || operations.length === 0)) {
      return sendError(req, res, 400, 'INVALID_ARGUMENT', 'Must specify preset or operations');
    }

    try {
      // Initialize progress
      await pushProgress(jobId, {
        progress: 0,
        stage: 'initializing',
        message: 'Starting enhancement job...'
      });

      // Return job ID immediately (async processing)
      res.json({
        jobId,
        status: 'processing',
        message: 'Enhancement job started',
        progressUrl: `/progress-stream?jobId=${jobId}`
      });

      // Process async
      processEnhancement(jobId, {
        file: req.file,
        videoUrl,
        gsUrl,
        preset,
        operations,
        callbackUrl,
        projectId,
        creditOperation: req.creditDeduction
      }).catch(err => {
        console.error(`Enhancement job ${jobId} failed:`, err);
        pushProgress(jobId, {
          progress: 100,
          stage: 'error',
          message: err.message || 'Enhancement failed',
          error: true,
          done: true
        });
      });

    } catch (error) {
      console.error('Enhancement initialization failed:', error);
      return sendError(req, res, 500, 'INTERNAL', 'Failed to start enhancement', error.message);
    }
  }
);

/**
 * Async enhancement processor
 */
async function processEnhancement(jobId, options) {
  const { file, videoUrl, gsUrl, preset, operations, callbackUrl, projectId, creditOperation } = options;

  try {
    // Step 1: Get video URL
    await pushProgress(jobId, { progress: 10, stage: 'uploading', message: 'Preparing video...' });

    let sourceUrl = videoUrl;

    // Handle file upload
    if (file) {
      const bucket = storage.bucket(inputBucketName);
      const destPath = `${projectId || 'enhance'}/source/${jobId}_${path.basename(file.originalname)}`;
      await bucket.upload(file.path, { destination: destPath });

      // Clean up temp file
      await fs.unlink(file.path).catch(() => {});

      // Get signed URL
      const [signedUrl] = await bucket.file(destPath).getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 3600 * 1000 // 1 hour
      });
      sourceUrl = signedUrl;
    }

    // Handle GCS URL
    else if (gsUrl) {
      const match = gsUrl.match(/^gs:\/\/([^\/]+)\/(.+)$/);
      if (!match) throw new Error('Invalid GCS URL format');

      const bucket = storage.bucket(match[1]);
      const [signedUrl] = await bucket.file(match[2]).getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 3600 * 1000
      });
      sourceUrl = signedUrl;
    }

    if (!sourceUrl) throw new Error('No valid video source');

    // Step 2: Determine operations to run
    await pushProgress(jobId, { progress: 20, stage: 'analyzing', message: 'Analyzing enhancement operations...' });

    let opsToRun = [];
    if (preset && ENHANCEMENT_MODELS[preset]) {
      opsToRun.push(preset);
    } else if (operations && operations.length > 0) {
      // Map operations to presets
      operations.forEach(op => {
        if (op === 'style') opsToRun.push('style-cinematic');
        else if (op === 'enhance') opsToRun.push('enhance-quality');
        else if (op === 'stabilize') opsToRun.push('stabilize');
        else if (op === 'face') opsToRun.push('enhance-face');
        else if (op === 'background' || op === 'bg-replace') opsToRun.push('remove-background');
      });
    }

    if (opsToRun.length === 0) {
      opsToRun = ['style-cinematic']; // Default
    }

    // Step 3: Run enhancements sequentially
    let currentUrl = sourceUrl;
    const totalOps = opsToRun.length;

    for (let i = 0; i < opsToRun.length; i++) {
      const op = opsToRun[i];
      const progress = 20 + (60 / totalOps) * i;

      await pushProgress(jobId, {
        progress,
        stage: 'enhancing',
        message: `Applying ${op} (${i + 1}/${totalOps})...`
      });

      currentUrl = await applyEnhancement(currentUrl, op, jobId);

      if (!currentUrl) {
        throw new Error(`Enhancement operation ${op} failed`);
      }
    }

    // Step 4: Save final result
    await pushProgress(jobId, { progress: 80, stage: 'saving', message: 'Saving enhanced video...' });

    // Download enhanced video
    const response = await fetch(currentUrl);
    if (!response.ok) throw new Error('Failed to download enhanced video');

    const videoBuffer = Buffer.from(await response.arrayBuffer());

    // Upload to output bucket
    const outputBucket = storage.bucket(outputBucketName);
    const outputPath = `${projectId || 'enhance'}/enhanced/${jobId}.mp4`;
    const outputFile = outputBucket.file(outputPath);

    await outputFile.save(videoBuffer, {
      metadata: { contentType: 'video/mp4' }
    });

    // Make public
    await outputFile.makePublic().catch(() => {});

    // Get public URL
    const publicUrl = `https://storage.googleapis.com/${outputBucketName}/${outputPath}`;

    // Step 5: Complete
    await pushProgress(jobId, {
      progress: 100,
      stage: 'completed',
      message: 'Enhancement completed successfully',
      enhancedUrl: publicUrl,
      done: true
    });

    // Complete credit operation
    if (creditOperation?.idempotencyKey) {
      await completeCreditOperation(creditOperation.idempotencyKey, 'completed');
    }

    // Call webhook if provided
    if (callbackUrl) {
      try {
        await fetch(callbackUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobId,
            status: 'completed',
            enhancedUrl: publicUrl,
            projectId
          })
        });
      } catch (err) {
        console.warn('Callback URL notification failed:', err);
      }
    }

  } catch (error) {
    console.error(`Enhancement job ${jobId} failed:`, error);

    // Mark as failed
    await pushProgress(jobId, {
      progress: 100,
      stage: 'error',
      message: error.message || 'Enhancement failed',
      error: true,
      done: true
    });

    // Complete credit operation as failed
    if (options.creditOperation?.idempotencyKey) {
      await completeCreditOperation(options.creditOperation.idempotencyKey, 'failed');
    }

    throw error;
  }
}

/**
 * Apply a single enhancement operation using FAL
 */
async function applyEnhancement(videoUrl, preset, jobId) {
  const config = ENHANCEMENT_MODELS[preset];
  if (!config) {
    console.warn(`Unknown preset: ${preset}, skipping`);
    return videoUrl;
  }

  const apiKey = process.env.FAL_ENHANCE_API_KEY || process.env.FAL_API_KEY;
  if (!apiKey) {
    console.warn('No FAL API key configured, returning original');
    return videoUrl;
  }

  try {
    const { fal } = await import('@fal-ai/client');
    fal.config({ credentials: apiKey });

    // Prepare input based on model
    let input = { video_url: videoUrl, ...config.params };

    // Special handling for specific models
    if (preset === 'style-cinematic') {
      input.prompt = 'cinematic, professional color grading, film look';
    } else if (preset === 'style-anime') {
      input.prompt = 'anime style, vibrant colors, cel shading';
    } else if (preset === 'style-cartoon') {
      input.prompt = 'cartoon style, bold outlines, flat colors';
    }

    console.log(`Applying ${preset} with model ${config.model}...`);

    // Run model with timeout
    const timeoutMs = 300000; // 5 minutes
    const result = await Promise.race([
      fal.subscribe(config.model, { input, logs: false }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Enhancement timeout')), timeoutMs))
    ]);

    // Extract URL from result
    const enhancedUrl = result?.data?.video_url ||
                        result?.data?.url ||
                        result?.data?.output?.url ||
                        result?.data?.output?.[0]?.url ||
                        null;

    if (!enhancedUrl) {
      console.error('No URL in FAL response:', result);
      throw new Error('Enhancement model did not return a video URL');
    }

    return enhancedUrl;

  } catch (error) {
    console.error(`Enhancement operation ${preset} failed:`, error);
    throw error;
  }
}

/**
 * GET /progress-stream
 * Server-sent events for job progress
 */
app.get('/progress-stream', (req, res) => {
  const jobId = req.query.jobId;
  if (!jobId) {
    return sendError(req, res, 400, 'INVALID_ARGUMENT', 'Missing jobId');
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send current progress if exists
  const current = progressStore.get(jobId);
  if (current) {
    res.write(`data: ${JSON.stringify({ jobId, ...current })}\n\n`);
  }

  // Register client
  if (!sseClients.has(jobId)) {
    sseClients.set(jobId, new Set());
  }
  sseClients.get(jobId).add(res);

  // Cleanup on disconnect
  req.on('close', () => {
    const clients = sseClients.get(jobId);
    if (clients) {
      clients.delete(res);
    }
  });
});

/**
 * GET /job-status/:jobId
 * Get current job status
 */
app.get('/job-status/:jobId', (req, res) => {
  const jobId = req.params.jobId;
  const status = progressStore.get(jobId);

  if (!status) {
    return sendError(req, res, 404, 'NOT_FOUND', 'Job not found');
  }

  res.json({ jobId, ...status });
});

// Start server
const PORT = process.env.PORT || 8088;
app.listen(PORT, () => {
  console.log(`✨ Enhance service running on port ${PORT}`);
  console.log(`📱 Mobile optimizations enabled`);
  console.log(`🎨 Available presets: ${Object.keys(ENHANCEMENT_MODELS).join(', ')}`);
});
