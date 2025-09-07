const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const { Storage } = require('@google-cloud/storage');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
app.use(express.json());
app.use(cors());

// Initialize Firebase Admin (for App Check verification)
if (!admin.apps.length) {
  admin.initializeApp();
}
const storage = new Storage();

// Observability
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

/**
 * POST /polish
 * Request: { projectId: string, videoUrl: string }
 * Response: { polishedUrl: string }
 */
app.post('/polish', appCheckVerification, async (req, res) => {
  const { projectId, videoUrl, userId } = req.body || {};
  if (!projectId || !videoUrl) {
    return sendError(req, res, 400, 'INVALID_ARGUMENT', 'Missing required fields: projectId, videoUrl');
  }

  try {
    let key = null;
    let usingCustomerKey = false;

    // First, try to get customer's FAL API key
    if (userId) {
      try {
        const apiKeyServiceUrl = process.env.API_KEY_SERVICE_URL || 'https://reel-banana-api-key-service-423229273041.us-central1.run.app';
        const response = await fetch(`${apiKeyServiceUrl}/get-api-key`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Firebase-AppCheck': req.header('X-Firebase-AppCheck'),
            'Authorization': req.header('Authorization')
          },
          body: JSON.stringify({ keyType: 'fal' })
        });

        if (response.ok) {
          const keyData = await response.json();
          key = keyData.apiKey;
          usingCustomerKey = true;
          console.log('Using customer FAL API key for polishing');
        }
      } catch (error) {
        console.warn('Failed to get customer FAL key, falling back to default:', error.message);
      }
    }

    // Fallback to default FAL key if no customer key
    if (!key) {
      key = process.env.FAL_API_KEY || process.env.FAL_KEY;
      if (!key) {
        console.warn('No FAL API key available (neither customer nor default). Returning original video URL.');
        return res.status(200).json({ polishedUrl: videoUrl });
      }
      console.log('Using default FAL API key for polishing');
    }
    const UPSCALE_ENDPOINT = process.env.FAL_UPSCALE_ENDPOINT || '';
    const INTERP_ENDPOINT = process.env.FAL_INTERP_ENDPOINT || '';
    const MODEL_UPSCALE = process.env.FAL_MODEL_UPSCALE || '';
    const MODEL_INTERP = process.env.FAL_MODEL_INTERP || '';

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Key ${key}`,
    };

    // Helper: resolve URL from Fal JSON
    const pickUrl = (j) => j?.output_url || j?.result?.url || j?.data?.url || j?.output?.url || j?.video?.url;

    // Helper: poll a response_url until done (generic Fal pattern)
    const pollIfNeeded = async (json) => {
      const responseUrl = json?.response_url || json?.status_url || json?.result_url;
      if (!responseUrl) return pickUrl(json) || null;

      const interval = parseInt(process.env.FAL_POLL_INTERVAL_MS || '3000', 10);
      const timeoutMs = parseInt(process.env.FAL_POLL_TIMEOUT_MS || '120000', 10);
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const r = await fetch(responseUrl, { headers });
        const j = await r.json().catch(() => ({}));
        const u = pickUrl(j);
        if (u) return u;
        const status = (j?.status || '').toString().toLowerCase();
        if (status === 'failed' || status === 'error') break;
        await new Promise(resolve => setTimeout(resolve, interval));
      }
      return null;
    };

    // Optional: Fal client subscribe runner (model-based)
    const runFalModel = async (modelId, input) => {
      try {
        const { fal } = await import('@fal-ai/client');
        fal.config({ credentials: key });
        const result = await fal.subscribe(modelId, { input, logs: false });
        // Try to derive URL generically
        return (
          pickUrl(result?.data) ||
          result?.data?.video_url ||
          result?.data?.url ||
          result?.data?.video?.url ||
          null
        );
      } catch (e) {
        console.warn(`Fal client run failed for ${modelId}:`, e?.message || e);
        return null;
      }
    };

    // Step 1: Upscale
    let currentUrl = videoUrl;
    if (MODEL_UPSCALE && !MODEL_INTERP) {
      // Single-call path when the upscaler supports interpolation
      let input = { video_url: currentUrl };
      if (MODEL_UPSCALE.includes('fal-ai/topaz/upscale/video')) {
        const upscaleFactor = parseFloat(process.env.UPSCALE_FACTOR || '2');
        const targetFps = parseInt(process.env.TARGET_FPS || '60', 10);
        input = { video_url: currentUrl, upscale_factor: upscaleFactor, target_fps: targetFps, H264_output: true };
      } else if (MODEL_UPSCALE.includes('fal-ai/video-upscaler')) {
        const scale = parseFloat(process.env.FAL_VIDEO_UPSCALE_SCALE || '2');
        input = { video_url: currentUrl, scale };
      } else if (MODEL_UPSCALE.includes('bria/video/increase-resolution')) {
        const desired = (process.env.FAL_BRIA_DESIRED_INCREASE || '2'); // '2' or '4'
        const codec = process.env.FAL_BRIA_OUTPUT_CODEC || 'mp4_h264';
        input = { video_url: currentUrl, desired_increase: desired, output_container_and_codec: codec };
      }
      const out = await runFalModel(MODEL_UPSCALE, input);
      if (out) currentUrl = out;
    } else if (MODEL_UPSCALE) {
      // Two-step path: run upscale first without interpolation baked in
      let input = { video_url: currentUrl };
      if (MODEL_UPSCALE.includes('fal-ai/topaz/upscale/video')) {
        const upscaleFactor = parseFloat(process.env.UPSCALE_FACTOR || '2');
        input = { video_url: currentUrl, upscale_factor: upscaleFactor, H264_output: true };
      } else if (MODEL_UPSCALE.includes('fal-ai/video-upscaler')) {
        const scale = parseFloat(process.env.FAL_VIDEO_UPSCALE_SCALE || '2');
        input = { video_url: currentUrl, scale };
      } else if (MODEL_UPSCALE.includes('bria/video/increase-resolution')) {
        const desired = (process.env.FAL_BRIA_DESIRED_INCREASE || '2');
        const codec = process.env.FAL_BRIA_OUTPUT_CODEC || 'mp4_h264';
        input = { video_url: currentUrl, desired_increase: desired, output_container_and_codec: codec };
      }
      const out = await runFalModel(MODEL_UPSCALE, input);
      if (out) currentUrl = out;
    } else if (UPSCALE_ENDPOINT) {
      try {
        const upRes = await fetch(UPSCALE_ENDPOINT, {
          method: 'POST',
          headers,
          body: JSON.stringify({ input_url: currentUrl, scale: 2 }),
        });
        const upJson = await upRes.json().catch(() => ({}));
        let out = pickUrl(upJson);
        if (!out) {
          out = await pollIfNeeded(upJson);
        }
        if (out) currentUrl = out;
      } catch (e) {
        console.warn('Fal upscale failed; continuing without upscaling:', e?.message || e);
      }
    }

    // Step 2: Interpolate
    if (MODEL_INTERP) {
      const out2 = await runFalModel(MODEL_INTERP, { video_url: currentUrl, target_fps: 60, H264_output: true });
      if (out2) currentUrl = out2;
    } else if (INTERP_ENDPOINT) {
      try {
        const intRes = await fetch(INTERP_ENDPOINT, {
          method: 'POST',
          headers,
          body: JSON.stringify({ input_url: currentUrl, target_fps: 60 }),
        });
        const intJson = await intRes.json().catch(() => ({}));
        let out = pickUrl(intJson);
        if (!out) {
          out = await pollIfNeeded(intJson);
        }
        if (out) currentUrl = out;
      } catch (e) {
        console.warn('Fal interpolation failed; continuing without interpolation:', e?.message || e);
      }
    }

    // Optional persistence to GCS for stability
    const outBucket = process.env.OUTPUT_BUCKET_NAME;
    if (outBucket) {
      try {
        const filename = `${projectId}/movie_polished.mp4`;
        const bucket = storage.bucket(outBucket);
        const file = bucket.file(filename);
        const remoteRes = await fetch(currentUrl);
        if (!remoteRes.ok) throw new Error(`Download failed: ${remoteRes.status}`);
        const arrayBuffer = await remoteRes.arrayBuffer();
        await file.save(Buffer.from(arrayBuffer), {
          metadata: { contentType: 'video/mp4' },
        });
        await file.makePublic();
        const publicUrl = file.publicUrl();
        return res.status(200).json({ polishedUrl: publicUrl });
      } catch (e) {
        console.warn('GCS persistence failed; returning remote URL:', e?.message || e);
      }
    }

    return res.status(200).json({ polishedUrl: currentUrl });

  } catch (error) {
    console.error('Polish failed:', error);
    return sendError(req, res, 500, 'INTERNAL', 'Failed to polish video', error?.message);
  }
});

// Lightweight health check (no App Check required)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'polish',
    usingApiKeyService: !!process.env.API_KEY_SERVICE_URL,
    hasDefaultFalKey: !!(process.env.FAL_API_KEY || process.env.FAL_KEY),
    time: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Polish service listening on port ${PORT}`);
});
