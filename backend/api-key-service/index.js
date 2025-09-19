// Force deployment for demo sync
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const admin = require('firebase-admin');
const { KeyManagementServiceClient } = require('@google-cloud/kms');
const { getUserQuotaStatus } = require('../shared/rateLimiter');
const { createHealthEndpoints, commonDependencyChecks } = require('../shared/healthCheck');
const { requireCredits, deductCreditsAfter, completeCreditOperation } = require('../shared/creditService');

const app = express();
const PORT = process.env.PORT || 8085;

// Trust the first proxy (Cloud Run/GFE) for correct IPs without being permissive
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());
// Dynamic CORS allowlist; allow no-origin for server-to-server calls
const defaultOrigins = [
  'https://reel-banana-35a54.web.app',
  'https://reelbanana.ai',
  'http://localhost:3000',
  'http://localhost:5173',
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

console.log('KMS Client initialized');
console.log('Project ID:', projectId);
console.log('Location ID:', locationId);
console.log('Key Ring ID:', keyRingId);
console.log('Key ID:', keyId);

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
    console.log('KMS key path:', name);
    console.log('Project ID:', projectId);
    console.log('Location ID:', locationId);
    console.log('Key Ring ID:', keyRingId);
    console.log('Key ID:', keyId);
    
    const [result] = await kmsClient.encrypt({
      name: name,
      plaintext: Buffer.from(plaintext),
      additionalAuthenticatedData: Buffer.from(userId)
    });
    return result.ciphertext.toString('base64');
  } catch (error) {
    console.error('Encryption failed:', error);
    console.error('Error details:', error.message);
    console.error('Error code:', error.code);
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

// Store API key securely (supports both Google and FAL keys)
app.post('/store-api-key', appCheckVerification, verifyToken, async (req, res) => {
  try {
    const { apiKey, keyType = 'google' } = req.body;
    const userId = req.user.uid;

    if (!apiKey || typeof apiKey !== 'string') {
      return sendError(req, res, 400, 'INVALID_ARGUMENT', 'Invalid API key');
    }

    // Validate API key format based on type
    if (keyType === 'google') {
      if (!apiKey.startsWith('AIza') || apiKey.length < 30) {
        return sendError(req, res, 400, 'INVALID_ARGUMENT', 'Invalid Google API key format');
      }
    } else if (keyType === 'fal') {
      if (!apiKey.includes(':') || apiKey.length < 20) {
        return sendError(req, res, 400, 'INVALID_ARGUMENT', 'Invalid FAL API key format');
      }
    } else if (keyType === 'elevenlabs') {
      if (!apiKey.startsWith('sk_') || apiKey.length < 20) {
        return sendError(req, res, 400, 'INVALID_ARGUMENT', 'Invalid ElevenLabs API key format');
      }
    } else {
      return sendError(req, res, 400, 'INVALID_ARGUMENT', 'Invalid key type. Must be "google", "fal", or "elevenlabs"');
    }

    // Encrypt the API key
    const encryptedKey = await encryptApiKey(apiKey, userId);

    // Store in Firestore (only encrypted version)
    const db = admin.firestore();
    await db.collection('user_api_keys').doc(userId).set({
      [`encryptedApiKey_${keyType}`]: encryptedKey,
      [`hasApiKey_${keyType}`]: true,
      [`keyType_${keyType}`]: keyType,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      keyVersion: '1.0'
    }, { merge: true });

    res.json({ success: true, message: 'API key stored securely', requestId: req.requestId });
  } catch (error) {
    console.error('Error storing API key:', error);
    return sendError(req, res, 500, 'INTERNAL', 'Failed to store API key');
  }
});

// Securely return user's API key to trusted backends (server-to-server only)
// NOTE: This endpoint is intended for backend services (e.g., polish) and must be protected by App Check + Auth.
// Body: { keyType: 'fal' | 'google' } - defaults to 'fal' for backward compatibility
app.post('/get-api-key', appCheckVerification, verifyToken, async (req, res) => {
  try {
    const { keyType = 'fal' } = req.body || {};
    const userId = req.user.uid;

    if (!['fal', 'google', 'elevenlabs'].includes(keyType)) {
      return sendError(req, res, 400, 'INVALID_ARGUMENT', 'Invalid key type. Must be "fal", "google", or "elevenlabs"');
    }

    const db = admin.firestore();
    const docSnap = await db.collection('user_api_keys').doc(userId).get();
    if (!docSnap.exists) {
      return sendError(req, res, 404, 'NOT_FOUND', 'No API key stored for this user');
    }
    const data = docSnap.data() || {};
    const encrypted = data[`encryptedApiKey_${keyType}`];
    const has = data[`hasApiKey_${keyType}`];
    if (!has || !encrypted) {
      return sendError(req, res, 404, 'NOT_FOUND', `No ${keyType.toUpperCase()} API key stored for this user`);
    }

    const apiKey = await decryptApiKey(encrypted, userId);
    // Do not log or echo beyond response body
    res.json({ 
      apiKey, 
      keyType: keyType,  // Use consistent field name
      requestId: req.requestId 
    });
  } catch (error) {
    console.error('Error getting API key:', error);
    return sendError(req, res, 500, 'INTERNAL', 'Failed to retrieve API key');
  }
});

// Use API key for AI requests (proxy)
app.post('/use-api-key', appCheckVerification, verifyToken, async (req, res) => {
  try {
    const { prompt, model = 'gemini-2.5-flash', imageInputs } = req.body;
    const userId = req.user.uid;

    console.log(`🔑 API Key Service: Processing request for user ${userId} with model ${model}`);

    if (!prompt) return sendError(req, res, 400, 'INVALID_ARGUMENT', 'Prompt is required');

    // Get encrypted API key from Firestore
    const db = admin.firestore();
    const keyDoc = await db.collection('user_api_keys').doc(userId).get();
    
    // Use provider-specific field name for Google key
    const encryptedField = 'encryptedApiKey_google';
    if (!keyDoc.exists || !keyDoc.data()[encryptedField]) {
      console.log(`❌ API Key Service: No API key found for user ${userId}`);
      return sendError(req, res, 404, 'NOT_FOUND', 'No API key found');
    }

    console.log(`✅ API Key Service: Found encrypted API key for user ${userId}, decrypting...`);

    // Decrypt the API key
    const decryptedKey = await decryptApiKey(keyDoc.data()[encryptedField], userId);
    
    console.log(`🔓 API Key Service: Successfully decrypted API key for user ${userId}, making request to Gemini API`);

    // Make request to Gemini API using the decrypted key
    // Build content parts (optional image inputs + text prompt)
    const parts = [];
    if (Array.isArray(imageInputs)) {
      for (const uri of imageInputs) {
        const m = String(uri).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
        if (!m) continue;
        parts.push({ inline_data: { mime_type: m[1], data: m[2] } });
      }
    }
    parts.push({ text: prompt });

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${decryptedKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }] })
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

// Check if user has API key (supports both Google and FAL keys)
app.get('/check-api-key', appCheckVerification, verifyToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { keyType = 'google' } = req.query;
    console.log(`🔍 API Key Service: Checking ${keyType} API key for user ${userId}`);
    
    const db = admin.firestore();
    const keyDoc = await db.collection('user_api_keys').doc(userId).get();
    const keyData = keyDoc.exists ? keyDoc.data() : {};
    
    const hasApiKey = keyDoc.exists && keyData[`hasApiKey_${keyType}`] === true;
    console.log(`🔍 API Key Service: User ${userId} has ${keyType} API key: ${hasApiKey}`);
    
    res.json({ 
      hasApiKey, 
      keyType: keyData[`keyType_${keyType}`] || null,
      requestId: req.requestId 
    });
  } catch (error) {
    console.error('Error checking API key:', error);
    return sendError(req, res, 500, 'INTERNAL', 'Failed to check API key');
  }
});

// Remove API key (supports both Google and FAL keys)
app.delete('/remove-api-key', appCheckVerification, verifyToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { keyType = 'google' } = req.body;
    const db = admin.firestore();
    
    const keyDoc = await db.collection('user_api_keys').doc(userId).get();
    if (!keyDoc.exists) {
      return sendError(req, res, 404, 'NOT_FOUND', 'No API key found');
    }
    
    const keyData = keyDoc.data();
    if (keyData[`hasApiKey_${keyType}`]) {
      // Remove the specific key type
      await db.collection('user_api_keys').doc(userId).update({
        [`encryptedApiKey_${keyType}`]: admin.firestore.FieldValue.delete(),
        [`hasApiKey_${keyType}`]: admin.firestore.FieldValue.delete(),
        [`keyType_${keyType}`]: admin.firestore.FieldValue.delete()
      });
    }
    
    res.json({ success: true, message: `${keyType} API key removed`, requestId: req.requestId });
  } catch (error) {
    console.error('Error removing API key:', error);
    return sendError(req, res, 500, 'INTERNAL', 'Failed to remove API key');
  }
});


// Quota status endpoint
app.get('/quota-status', appCheckVerification, verifyToken, async (req, res) => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      return sendError(req, res, 401, 'UNAUTHORIZED', 'User not authenticated');
    }
    
    const quotaStatus = await getUserQuotaStatus(userId);
    res.json({
      userId,
      quotaStatus,
      requestId: req.requestId
    });
  } catch (error) {
    console.error('Quota status error:', error);
    sendError(req, res, 500, 'INTERNAL_ERROR', 'Failed to get quota status');
  }
});

// Health check endpoints
createHealthEndpoints(app, 'api-key-service', 
  {
    kmsConfigured: !!process.env.KMS_KEY_RING_ID
  },
  {
    dependencies: {
      firebase: () => commonDependencyChecks.firebase(),
      kms: async () => {
        try {
          if (!process.env.KMS_KEY_RING_ID) {
            throw new Error('KMS Key Ring ID not configured');
          }
          return { message: 'KMS Key Ring configured' };
        } catch (error) {
          throw new Error(`KMS check failed: ${error.message}`);
        }
      }
    }
  }
);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`API Key Service running on port ${PORT}`);
});
