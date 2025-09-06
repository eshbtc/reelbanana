const express = require('express');
const cors = require('cors');
const { Storage } = require('@google-cloud/storage');
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

const storage = new Storage();
const bucketName = process.env.INPUT_BUCKET_NAME || 'reel-banana-35a54.firebasestorage.app';

// Music prompt generation using keyword analysis
function generateMusicPrompt(narrationScript) {
  const script = narrationScript.toLowerCase();
  
  if (script.includes('adventure') || script.includes('journey') || script.includes('quest')) {
    return "An epic, adventurous orchestral score with triumphant brass and driving percussion";
  } else if (script.includes('mystery') || script.includes('secret') || script.includes('hidden')) {
    return "A mysterious, atmospheric score with haunting strings and subtle percussion";
  } else if (script.includes('happy') || script.includes('joy') || script.includes('celebration')) {
    return "An upbeat, cheerful orchestral score with bright melodies and uplifting harmonies";
  } else if (script.includes('sad') || script.includes('melancholy') || script.includes('tear')) {
    return "A gentle, melancholic score with soft strings and emotional depth";
  } else if (script.includes('magic') || script.includes('fantasy') || script.includes('wonder')) {
    return "A whimsical, magical orchestral score with sparkling melodies and enchanting harmonies";
  } else {
    return "A balanced, cinematic orchestral score with emotional depth and dynamic range";
  }
}

/**
 * POST /compose-music
 * Generates a musical score based on narration script mood and saves it to GCS.
 *
 * Request Body:
 * {
 *   "projectId": "string",
 *   "narrationScript": "The full text of the narration."
 * }
 *
 * Response:
 * {
 *   "gsMusicPath": "gs://bucket-name/project-id/music.mp3"
 * }
 */
app.post('/compose-music', appCheckVerification, async (req, res) => {
  const { projectId, narrationScript } = req.body;

  if (!projectId || !narrationScript) {
    return sendError(req, res, 400, 'INVALID_ARGUMENT', 'Missing required fields: projectId and narrationScript');
  }


  console.log(`Received music composition request for projectId: ${projectId}`);

  try {
    // Check if music file already exists to avoid re-processing
    const bucket = storage.bucket(bucketName);
    const fileName = `${projectId}/music.mp3`;
    const file = bucket.file(fileName);
    
    const [exists] = await file.exists();
    if (exists) {
      const gsMusicPath = `gs://${bucketName}/${fileName}`;
      console.log(`Music already exists for ${projectId} at ${gsMusicPath}, skipping Gemini processing`);
      return res.status(200).json({ 
        gsMusicPath: gsMusicPath,
        musicPrompt: "Previously generated",
        requestId: req.requestId,
        cached: true
      });
    }
    // 1. Generate music prompt based on narration content analysis
    const musicPrompt = generateMusicPrompt(narrationScript);
    console.log(`Generated music prompt: "${musicPrompt}"`);

    // 2. For hackathon demo, create a placeholder audio file
    // In production, you would use a music generation API here
    // Reuse bucket, fileName, and file variables from cache check above
    
    // Create a simple audio file (placeholder - in production, use actual music generation)
    const audioBuffer = createPlaceholderAudio(musicPrompt);
    
    await file.save(audioBuffer, {
      metadata: { contentType: 'audio/mpeg' },
    });

    const gsMusicPath = `gs://${bucketName}/${fileName}`;
    console.log(`Successfully created music for ${projectId} at ${gsMusicPath}`);

    res.status(200).json({ 
      gsMusicPath: gsMusicPath,
      musicPrompt: musicPrompt,
      requestId: req.requestId
    });

  } catch (error) {
    console.error(`Error composing music for projectId ${projectId}:`, error);
    return sendError(req, res, 500, 'INTERNAL', 'Failed to compose music.', error.message);
  }
});

// Lightweight health check (no App Check required)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'compose-music',
    aiConfigured: true, // Using Firebase AI Logic
    bucket: bucketName,
    time: new Date().toISOString()
  });
});

/**
 * Create a placeholder audio file based on mood analysis
 * In production, this would be replaced with actual music generation
 */

function createPlaceholderAudio(musicPrompt) {
  // This is a simplified placeholder - in reality, you'd use a music generation API
  // For the hackathon demo, we'll create a simple tone sequence
  
  const fs = require('fs');
  const path = require('path');
  
  // Create a simple audio file with different tones based on mood keywords
  let frequency = 440; // Base frequency (A4)
  
  if (musicPrompt.toLowerCase().includes('adventurous') || musicPrompt.toLowerCase().includes('exciting')) {
    frequency = 523; // C5
  } else if (musicPrompt.toLowerCase().includes('mysterious') || musicPrompt.toLowerCase().includes('dark')) {
    frequency = 349; // F4
  } else if (musicPrompt.toLowerCase().includes('uplifting') || musicPrompt.toLowerCase().includes('happy')) {
    frequency = 659; // E5
  } else if (musicPrompt.toLowerCase().includes('dramatic') || musicPrompt.toLowerCase().includes('epic')) {
    frequency = 392; // G4
  } else if (musicPrompt.toLowerCase().includes('whimsical') || musicPrompt.toLowerCase().includes('playful')) {
    frequency = 587; // D5
  }
  
  // For demo purposes, create a simple sine wave audio
  // In production, replace with actual music generation
  const duration = 30; // 30 seconds
  const sampleRate = 44100;
  const samples = duration * sampleRate;
  const buffer = Buffer.alloc(samples * 2); // 16-bit audio
  
  for (let i = 0; i < samples; i++) {
    const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.1; // Low volume
    const intSample = Math.round(sample * 32767);
    buffer.writeInt16LE(intSample, i * 2);
  }
  
  return buffer;
}

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Music composition service listening on port ${PORT}`);
});
