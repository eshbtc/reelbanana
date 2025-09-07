const express = require('express');
const cors = require('cors');
const { Storage } = require('@google-cloud/storage');
// Trigger Cloud Run deployment after rendering pipeline fixes
const admin = require('firebase-admin');
const { createExpensiveOperationLimiter } = require('./shared/rateLimiter');
const { createHealthEndpoints, commonDependencyChecks } = require('./shared/healthCheck');

const app = express();

// Trust proxy for Cloud Run (fixes X-Forwarded-For header issue for IP rate limiting)
app.set('trust proxy', true);

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
// Use the Firebase Storage bucket for the project
const bucketName = process.env.INPUT_BUCKET_NAME || 'reel-banana-35a54.firebasestorage.app';

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

// Validate bucket exists and is accessible
const validateBucket = async () => {
  try {
    const bucket = storage.bucket(bucketName);
    const [exists] = await bucket.exists();
    if (!exists) {
      console.error(`❌ Bucket ${bucketName} does not exist or is not accessible`);
      throw new Error(`Bucket ${bucketName} not found`);
    }
    
    // Test write permissions
    const testFile = bucket.file(`test-${Date.now()}.txt`);
    await testFile.save('test', { metadata: { contentType: 'text/plain' } });
    await testFile.delete();
    
    console.log(`✅ Bucket ${bucketName} validated successfully`);
  } catch (error) {
    console.error(`❌ Bucket validation failed for ${bucketName}:`, error);
    throw new Error(`Bucket validation failed: ${error.message}`);
  }
};

// Validate bucket on startup
validateBucket().catch(error => {
  console.error('Failed to validate bucket on startup:', error);
  process.exit(1);
});

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
 *   "gcsPath": "gs://reel-banana-35a54.firebasestorage.app/projectId/fileName"
 * }
 */
app.post('/upload-image', ...createExpensiveOperationLimiter('upload'), appCheckVerification, async (req, res) => {
  const { projectId, fileName, base64Image } = req.body;

  if (!projectId || !fileName || !base64Image) {
    return sendError(req, res, 400, 'INVALID_ARGUMENT', 'Missing required fields: projectId, fileName, and base64Image.');
  }

  // Validate input parameters
  if (typeof projectId !== 'string' || projectId.length === 0) {
    return sendError(req, res, 400, 'INVALID_ARGUMENT', 'projectId must be a non-empty string');
  }
  if (typeof fileName !== 'string' || fileName.length === 0) {
    return sendError(req, res, 400, 'INVALID_ARGUMENT', 'fileName must be a non-empty string');
  }
  if (typeof base64Image !== 'string' || !base64Image.startsWith('data:image/')) {
    return sendError(req, res, 400, 'INVALID_ARGUMENT', 'base64Image must be a valid data URI');
  }

  try {
    const bucket = storage.bucket(bucketName);
    
    // Parse data URI
    const match = String(base64Image).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
    if (!match) return sendError(req, res, 400, 'INVALID_ARGUMENT', 'Invalid base64 image data URI');
    const mime = match[1];
    const data = match[2];
    const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpeg';

    // Sanitize filename and project ID
    const safeProjectId = projectId.replace(/[^a-zA-Z0-9-_]/g, '_');
    const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_').replace(/\.[a-zA-Z0-9]+$/, `.${ext}`);
    const fullPath = `${safeProjectId}/${safeName}`;
    const file = bucket.file(fullPath);

    const imageBuffer = Buffer.from(data, 'base64');
    
    // Validate image size (max 10MB)
    if (imageBuffer.length > 10 * 1024 * 1024) {
      return sendError(req, res, 400, 'INVALID_ARGUMENT', 'Image size exceeds 10MB limit');
    }
    
    console.log(`📤 Uploading image: ${safeName} (${(imageBuffer.length / 1024).toFixed(1)}KB) for project ${safeProjectId}`);
    
    // Upload with retry logic
    await retryWithBackoff(async () => {
      await file.save(imageBuffer, { metadata: { contentType: mime } });
    });
    
    // Make public with retry logic
    await retryWithBackoff(async () => {
      await file.makePublic();
    });

    const gcsPath = `gs://${bucketName}/${fullPath}`;
    const publicUrl = `https://storage.googleapis.com/${bucketName}/${fullPath}`;
    
    console.log(`✅ Successfully uploaded ${safeName} for project ${safeProjectId} to ${gcsPath}`);
    
    res.status(200).json({ 
        message: 'Image uploaded successfully.',
        gcsPath,
        publicUrl,
        size: imageBuffer.length,
        contentType: mime
    });

  } catch (error) {
    console.error(`❌ Error uploading image for projectId ${projectId}:`, error);
    
    // Provide more specific error messages
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return sendError(req, res, 503, 'SERVICE_UNAVAILABLE', 'Storage service unavailable', error.message);
    } else if (error.code === 'PERMISSION_DENIED') {
      return sendError(req, res, 403, 'PERMISSION_DENIED', 'Insufficient permissions to upload to bucket', error.message);
    } else if (error.code === 'NOT_FOUND') {
      return sendError(req, res, 404, 'NOT_FOUND', 'Bucket not found', error.message);
    }
    
    return sendError(req, res, 500, 'INTERNAL', 'Failed to upload image', error.message);
  }
});

// Lightweight health check (no App Check required)
// Health check endpoints
createHealthEndpoints(app, 'upload-assets', 
  {
    bucket: bucketName
  },
  {
    dependencies: {
      gcs: () => commonDependencyChecks.gcs(bucketName),
      firebase: () => commonDependencyChecks.firebase()
    }
  }
);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Upload-assets service listening on port ${PORT}`);
});
