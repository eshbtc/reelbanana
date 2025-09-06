const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const admin = require('firebase-admin');
const { KeyManagementServiceClient } = require('@google-cloud/kms');

const app = express();
const PORT = process.env.PORT || 8085;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: [
    'https://reel-banana-35a54.web.app',
    'https://reelbanana.ai',
    'http://localhost:3000',
    'http://localhost:5173'
  ],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});
app.use(limiter);

app.use(express.json({ limit: '10mb' }));

// --- Observability & Error Helpers ---
const { randomUUID } = require('crypto');

// Attach requestId and start time
app.use((req, res, next) => {
  req.requestId = randomUUID();
  req.startTime = Date.now();
  res.setHeader('X-Request-Id', req.requestId);
  next();
});

// Structured access log on response finish
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
      userId: req.user?.uid || undefined,
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
    // Store the claims for potential use in the route handler
    req.appCheckClaims = appCheckClaims;
    return next();
  } catch (err) {
    console.error('App Check verification failed:', err);
    return sendError(req, res, 401, 'APP_CHECK_INVALID', 'Invalid App Check token');
  }
};

// Initialize KMS
const kmsClient = new KeyManagementServiceClient();
const projectId = 'reel-banana-35a54';
const locationId = 'global';
const keyRingId = 'api-keys';
const keyId = 'user-api-keys';

// Middleware to verify Firebase ID token
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No valid authorization header' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Token verification failed:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Encrypt API key using KMS
async function encryptApiKey(plaintext, userId) {
  try {
    const name = kmsClient.cryptoKeyPath(projectId, locationId, keyRingId, keyId);
    const [result] = await kmsClient.encrypt({
      name: name,
      plaintext: Buffer.from(plaintext),
      additionalAuthenticatedData: Buffer.from(userId)
    });
    return result.ciphertext.toString('base64');
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt API key');
  }
}

// Decrypt API key using KMS
async function decryptApiKey(ciphertext, userId) {
  try {
    const name = kmsClient.cryptoKeyPath(projectId, locationId, keyRingId, keyId);
    const [result] = await kmsClient.decrypt({
      name: name,
      ciphertext: Buffer.from(ciphertext, 'base64'),
      additionalAuthenticatedData: Buffer.from(userId)
    });
    return result.plaintext.toString();
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt API key');
  }
}

// Store API key securely
app.post('/store-api-key', appCheckVerification, verifyToken, async (req, res) => {
  try {
    const { apiKey } = req.body;
    const userId = req.user.uid;

    if (!apiKey || typeof apiKey !== 'string') {
      return sendError(req, res, 400, 'INVALID_ARGUMENT', 'Invalid API key');
    }

    // Validate API key format (basic validation)
    if (!apiKey.startsWith('AIza') || apiKey.length < 30) {
      return sendError(req, res, 400, 'INVALID_ARGUMENT', 'Invalid API key format');
    }

    // Encrypt the API key
    const encryptedKey = await encryptApiKey(apiKey, userId);

    // Store in Firestore (only encrypted version)
    const db = admin.firestore();
    await db.collection('user_api_keys').doc(userId).set({
      encryptedApiKey: encryptedKey,
      hasApiKey: true,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      keyVersion: '1.0'
    });

    res.json({ success: true, message: 'API key stored securely', requestId: req.requestId });
  } catch (error) {
    console.error('Error storing API key:', error);
    return sendError(req, res, 500, 'INTERNAL', 'Failed to store API key');
  }
});

// Use API key for AI requests (proxy)
app.post('/use-api-key', appCheckVerification, verifyToken, async (req, res) => {
  try {
    const { prompt, model = 'gemini-2.5-flash' } = req.body;
    const userId = req.user.uid;

    if (!prompt) {
      return sendError(req, res, 400, 'INVALID_ARGUMENT', 'Prompt is required');
    }

    // Get encrypted API key from Firestore
    const db = admin.firestore();
    const keyDoc = await db.collection('user_api_keys').doc(userId).get();
    
    if (!keyDoc.exists || !keyDoc.data().encryptedApiKey) {
      return sendError(req, res, 404, 'NOT_FOUND', 'No API key found');
    }

    // Decrypt the API key
    const decryptedKey = await decryptApiKey(keyDoc.data().encryptedApiKey, userId);

    // Make request to Gemini API using the decrypted key
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${decryptedKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const result = await response.json();
    res.json(result);
  } catch (error) {
    console.error('Error using API key:', error);
    return sendError(req, res, 500, 'INTERNAL', 'Failed to process request');
  }
});

// Check if user has API key
app.get('/check-api-key', appCheckVerification, verifyToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const db = admin.firestore();
    
    const keyDoc = await db.collection('user_api_keys').doc(userId).get();
    const hasApiKey = keyDoc.exists && keyDoc.data().hasApiKey;
    
    res.json({ hasApiKey, requestId: req.requestId });
  } catch (error) {
    console.error('Error checking API key:', error);
    return sendError(req, res, 500, 'INTERNAL', 'Failed to check API key');
  }
});

// Remove API key
app.delete('/remove-api-key', appCheckVerification, verifyToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const db = admin.firestore();
    
    await db.collection('user_api_keys').doc(userId).delete();
    
    res.json({ success: true, message: 'API key removed', requestId: req.requestId });
  } catch (error) {
    console.error('Error removing API key:', error);
    return sendError(req, res, 500, 'INTERNAL', 'Failed to remove API key');
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`API Key Service running on port ${PORT}`);
});
