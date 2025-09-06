const express = require('express');
const cors = require('cors');
const { Storage } = require('@google-cloud/storage');
const admin = require('firebase-admin');

const app = express();
app.use(express.json({ limit: '10mb' })); // Limit for a single base64 image
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

const storage = new Storage();
const bucketName = process.env.INPUT_BUCKET_NAME || 'oneminute-movie-in';

/**
 * POST /upload-image
 * Receives a single base64 image and its desired filename, then uploads to GCS.
 *
 * Request Body:
 * {
 *   "projectId": "string",
 *   "fileName": "scene-0-0.jpeg",
 *   "base64Image": "data:image/jpeg;base64,..."
 * }
 *
 * Response:
 * {
 *   "message": "Image uploaded successfully."
 *   "gcsPath": "gs://oneminute-movie-in/projectId/fileName"
 * }
 */
app.post('/upload-image', appCheckVerification, async (req, res) => {
  const { projectId, fileName, base64Image } = req.body;

  if (!projectId || !fileName || !base64Image) {
    return sendError(req, res, 400, 'INVALID_ARGUMENT', 'Missing required fields: projectId, fileName, and base64Image.');
  }

  try {
    const bucket = storage.bucket(bucketName);
    
    const fullPath = `${projectId}/${fileName}`;
    const file = bucket.file(fullPath);
    
    const base64Data = base64Image.replace(/^data:image\/jpeg;base64,/, "");
    const imageBuffer = Buffer.from(base64Data, 'base64');
    
    await file.save(imageBuffer, {
      metadata: { contentType: 'image/jpeg' },
    });

    const gcsPath = `gs://${bucketName}/${fullPath}`;
    console.log(`Successfully uploaded ${fileName} for ${projectId}.`);
    res.status(200).json({ 
        message: 'Image uploaded successfully.',
        gcsPath: gcsPath
    });

  } catch (error) {
    console.error(`Error uploading image for projectId ${projectId}:`, error);
    return sendError(req, res, 500, 'INTERNAL', 'Failed to upload image.', error.message);
  }
});

const PORT = process.env.PORT || 8083;
app.listen(PORT, () => {
  console.log(`Upload-assets service listening on port ${PORT}`);
});
