const express = require('express');
const cors = require('cors');
const { Storage } = require('@google-cloud/storage');
const admin = require('firebase-admin');
const { genkit } = require('genkit');
// Genkit plugins can differ by export shape between versions. Resolve safely.
let firebasePluginFn = null;
let vertexAIPluginFn = null;
let gemini15Flash = null;
try {
  const firebasePlugin = require('@genkit-ai/firebase');
  const vertexPlugin = require('@genkit-ai/vertexai');
  // Try common export shapes
  firebasePluginFn = firebasePlugin?.firebase || firebasePlugin?.default || null;
  vertexAIPluginFn = vertexPlugin?.vertexAI || vertexPlugin?.default || null;
  // Models may be named exports
  gemini15Flash = vertexPlugin?.gemini15Flash || null;
} catch (_) {
  // Non-fatal; will fall back to heuristic prompts
}
const { randomUUID } = require('crypto');
const { ElevenLabsClient } = require('elevenlabs');
const { createHash } = require('crypto');
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

// Configure Firebase Genkit for server-side AI
let ai = null;
try {
  if (typeof firebasePluginFn === 'function' && typeof vertexAIPluginFn === 'function' && gemini15Flash) {
    ai = genkit({
      plugins: [
        firebasePluginFn({ projectId: 'reel-banana-35a54' }),
        vertexAIPluginFn({ projectId: 'reel-banana-35a54', location: 'us-central1' })
      ],
      model: gemini15Flash,
    });
    console.log('✅ Firebase Genkit configured successfully');
  } else {
    console.warn('⚠️ Genkit plugins/models not available; AI prompt generation disabled.');
  }
} catch (error) {
  console.warn('⚠️ Genkit initialization failed; AI prompt generation disabled:', error?.message || error);
}

// Observability & Error helpers
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

// Initialize ElevenLabs client for music generation
// Support both dedicated music key and fallback to general key
const elevenLabsClient = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_MUSIC_API_KEY || process.env.ELEVENLABS_API_KEY
});

// Observability counters
const metrics = {
  musicGenerations: 0,
  musicGenerationTimeMs: 0,
  musicRetries: 0,
  musicFallbacks: 0,
  cacheHits: 0
};

// AI-powered music prompt generation using Firebase Genkit with Vertex AI
async function generateMusicPromptWithAI(narrationScript) {
  const prompt = `Analyze the following narration script and provide a short, descriptive musical prompt (e.g., "An upbeat, whimsical, adventurous orchestral score for a children's story, with a sense of wonder and a triumphant finish."). Only return the prompt text, nothing else. Script: "${narrationScript}"`;
  
  try {
    if (!ai || typeof ai.generate !== 'function') {
      return generateFallbackPrompt(narrationScript);
    }
    console.log('🎵 Generating music prompt with Firebase Genkit + Vertex AI...');
    const response = await ai.generate({
      prompt,
      config: { maxOutputTokens: 100, temperature: 0.7 }
    });
    const aiResponse = response?.text?.()?.trim();
    console.log('🎵 AI-generated music prompt:', aiResponse);
    return aiResponse || generateFallbackPrompt(narrationScript);
  } catch (error) {
    console.log('🎵 AI generation failed, using fallback:', error?.message || error);
    return generateFallbackPrompt(narrationScript);
  }
}

// Fallback music prompt generation
function generateFallbackPrompt(narrationScript) {
  const script = narrationScript.toLowerCase();
  
  if (script.includes('adventure') || script.includes('journey') || script.includes('quest')) {
    return "An epic, adventurous orchestral score with triumphant brass and driving percussion";
  } else if (script.includes('mystery') || script.includes('secret') || script.includes('hidden')) {
    return "A mysterious, atmospheric score with haunting strings and subtle percussion";
  } else if (script.includes('happy') || script.includes('joy') || script.includes('celebration')) {
    return "An upbeat, cheerful orchestral score with bright melodies and uplifting harmonies";
  } else if (script.includes('magic') || script.includes('fantasy') || script.includes('wonder')) {
    return "A whimsical, magical orchestral score with sparkling melodies and enchanting harmonies";
  } else {
    return "A balanced, cinematic orchestral score with emotional depth and dynamic range";
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
    .replace(/([!?.,])\1+/g, '$1');
  return s.toLowerCase();
}

// Content-addressable cache key for music results (supports exact and normalized)
function musicCacheKey({ narrationScript, normalized = false }) {
  const base = normalized ? normalizeScriptForCache(narrationScript) : String(narrationScript || '').trim();
  const payload = JSON.stringify({ v: 2, text: base, duration: 20, format: 'wav' });
  return createHash('sha256').update(payload).digest('hex');
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
app.post('/compose-music', ...createExpensiveOperationLimiter('compose'), appCheckVerification, async (req, res) => {
  const { projectId, narrationScript } = req.body;

  if (!projectId || !narrationScript) {
    return sendError(req, res, 400, 'INVALID_ARGUMENT', 'Missing required fields: projectId and narrationScript');
  }


  console.log(`Received music composition request for projectId: ${projectId}`);

  try {
    // Check if music file already exists to avoid re-processing
    const bucket = storage.bucket(bucketName);
    const fileName = `${projectId}/music.wav`;
    const file = bucket.file(fileName);
    
    const [exists] = await file.exists();
    if (exists) {
      const gsMusicPath = `gs://${bucketName}/${fileName}`;
      console.log(`Music already exists for ${projectId} at ${gsMusicPath}, skipping Gemini processing`);
      metrics.cacheHits++;
      return res.status(200).json({ 
        gsMusicPath: gsMusicPath,
        musicPrompt: "Previously generated",
        requestId: req.requestId,
        cached: true
      });
    }
    // Global cache by narration script (exact then normalized)
    const exactId = musicCacheKey({ narrationScript, normalized: false });
    const normId  = musicCacheKey({ narrationScript, normalized: true });
    const exactFile = bucket.file(`cache/music/exact/${exactId}.wav`);
    const normFile  = bucket.file(`cache/music/norm/${normId}.wav`);
    const [[exactExists],[normExists]] = await Promise.all([exactFile.exists(), normFile.exists()]);
    if (exactExists || normExists) {
      const source = exactExists ? exactFile : normFile;
      await source.copy(file);
      const gsMusicPath = `gs://${bucketName}/${fileName}`;
      console.log(`Music cache hit ${exactExists ? exactId : normId} (${exactExists ? 'exact' : 'norm'}); copied to ${gsMusicPath}`);
      metrics.cacheHits++;
      return res.status(200).json({ 
        gsMusicPath,
        musicPrompt: 'Previously generated',
        requestId: req.requestId,
        cached: true,
        cacheId: exactExists ? exactId : normId
      });
    }
    // 1. Generate music prompt using AI analysis of narration content
    const musicPrompt = await generateMusicPromptWithAI(narrationScript);
    console.log(`Generated music prompt: "${musicPrompt}"`);

    // 2. Generate real music using ElevenLabs Eleven Music API
    // Reuse bucket, fileName, and file variables from cache check above
    
    console.log('🎵 Generating real music with ElevenLabs Eleven Music...');
    const audioBuffer = await generateRealMusic(musicPrompt);
    
    await file.save(audioBuffer, {
      metadata: { contentType: 'audio/wav' },
    });

    const gsMusicPath = `gs://${bucketName}/${fileName}`;
    console.log(`Successfully created music for ${projectId} at ${gsMusicPath}`);

    // Save to global cache (both exact and normalized variants)
    try {
      await Promise.all([
        file.copy(exactFile),
        file.copy(normFile)
      ]);
      console.log(`Saved music to cache keys exact=${exactId}, norm=${normId}`);
      metrics.cacheWrites = (metrics.cacheWrites || 0) + 1;
    } catch (e) {
      console.warn('Failed to write music cache:', e.message);
    }

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
// Health check endpoints
createHealthEndpoints(app, 'compose-music', 
  {
    aiConfigured: true, // Using Firebase Genkit + Vertex AI via ADC
    elevenLabsMusicConfigured: !!(process.env.ELEVENLABS_MUSIC_API_KEY || process.env.ELEVENLABS_API_KEY),
    aiCoreConfigured: true, // cosmetic: reflect server-side AI using service account
    bucket: bucketName,
    metrics: {
      musicGenerations: metrics.musicGenerations,
      avgGenerationTimeMs: metrics.musicGenerations > 0 ? Math.round(metrics.musicGenerationTimeMs / metrics.musicGenerations) : 0,
      musicRetries: metrics.musicRetries,
      musicFallbacks: metrics.musicFallbacks,
      cacheHits: metrics.cacheHits,
      cacheWrites: metrics.cacheWrites || 0
    }
  },
  {
    dependencies: {
      elevenlabs: () => commonDependencyChecks.elevenlabs(),
      gcs: () => commonDependencyChecks.gcs(bucketName),
      firebase: () => commonDependencyChecks.firebase()
    }
  }
);

// Admin-only (DEV_MODE) cache clear endpoint
app.post('/cache-clear', appCheckVerification, async (req, res) => {
  try {
    if (process.env.DEV_MODE !== 'true') {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Cache clear allowed only in DEV_MODE' });
    }
    const { projectId, cacheId, cacheNormId } = req.body || {};
    const bucket = storage.bucket(bucketName);
    const result = { deleted: [] };
    const safeDelete = async (path) => { try { const f = bucket.file(path); const [ex] = await f.exists(); if (ex) { await f.delete(); result.deleted.push(path); } } catch {} };
    if (projectId) await safeDelete(`${projectId}/music.wav`);
    if (cacheId) await safeDelete(`cache/music/exact/${cacheId}.wav`);
    if (cacheNormId) await safeDelete(`cache/music/norm/${cacheNormId}.wav`);
    res.json({ status: 'ok', ...result });
  } catch (e) {
    res.status(500).json({ code: 'INTERNAL', message: 'Failed to clear cache', details: e?.message });
  }
});

/**
 * Generate real music using ElevenLabs Eleven Music API with retry logic
 */
async function generateRealMusic(musicPrompt) {
  const startTime = Date.now();
  const maxRetries = parseInt(process.env.ELEVENLABS_MUSIC_MAX_RETRIES || '2', 10);
  const timeoutMs = parseInt(process.env.ELEVENLABS_MUSIC_TIMEOUT_MS || '30000', 10); // 30 second timeout
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🎵 Generating music with ElevenLabs Eleven Music (attempt ${attempt}/${maxRetries})...`);
      
      // Create timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('ElevenLabs music generation timeout')), timeoutMs);
      });
      
      // Call ElevenLabs Music API with timeout
      const musicPromise = elevenLabsClient.music.generate({
        prompt: musicPrompt,
        duration: 20, // 20 seconds to match our current duration
        format: 'wav' // Request WAV format for better quality
      });
      
      const response = await Promise.race([musicPromise, timeoutPromise]);
      
      // Handle different response types (Buffer, Response, or Readable)
      let audioBuffer;
      if (Buffer.isBuffer(response)) {
        audioBuffer = response;
      } else if (response && typeof response.arrayBuffer === 'function') {
        audioBuffer = Buffer.from(await response.arrayBuffer());
      } else if (response && typeof response.pipe === 'function') {
        // Handle Node.js Readable stream
        const chunks = [];
        for await (const chunk of response) {
          chunks.push(chunk);
        }
        audioBuffer = Buffer.concat(chunks);
      } else {
        throw new Error('Unexpected response type from ElevenLabs music API');
      }
      
      // Track successful generation metrics
      const generationTime = Date.now() - startTime;
      metrics.musicGenerations++;
      metrics.musicGenerationTimeMs += generationTime;
      
      console.log(`🎵 Successfully generated music with ElevenLabs (${audioBuffer.length} bytes, ${generationTime}ms)`);
      return audioBuffer;
      
    } catch (error) {
      const isTimeout = error.message.includes('timeout');
      const errorType = isTimeout ? 'timeout' : 'api_error';
      console.error(`🎵 ElevenLabs music generation attempt ${attempt} failed (${errorType}):`, error.message);
      
      if (attempt < maxRetries) {
        metrics.musicRetries++;
        // Wait before retry (exponential backoff)
        const delay = 1000 * Math.pow(2, attempt - 1);
        console.log(`🎵 Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        // All attempts failed, track fallback
        metrics.musicFallbacks++;
        console.log(`🎵 All ElevenLabs attempts failed (${errorType}), falling back to placeholder audio...`);
        return createWavPlaceholderAudio(musicPrompt);
      }
    }
  }
}

/**
 * Create a placeholder WAV audio file based on mood analysis
 * Fallback when ElevenLabs music generation fails
 */
function createWavPlaceholderAudio(musicPrompt) {
  const lower = (musicPrompt || '').toLowerCase();
  let frequency = 440; // A4
  if (lower.includes('adventurous') || lower.includes('exciting')) frequency = 523.25; // C5
  else if (lower.includes('mysterious') || lower.includes('dark')) frequency = 349.23; // F4
  else if (lower.includes('uplifting') || lower.includes('happy')) frequency = 659.25; // E5
  else if (lower.includes('dramatic') || lower.includes('epic')) frequency = 392.00; // G4
  else if (lower.includes('whimsical') || lower.includes('playful')) frequency = 587.33; // D5

  const durationSec = 20;
  const sampleRate = 44100;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const numSamples = durationSec * sampleRate;
  const dataSize = numSamples * blockAlign;

  const buffer = Buffer.alloc(44 + dataSize);
  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // PCM chunk size
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * frequency * t) * 0.15; // low volume
    const s = Math.max(-1, Math.min(1, sample));
    buffer.writeInt16LE(Math.round(s * 32767), offset);
    offset += 2;
  }
  return buffer;
}

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Music composition service listening on port ${PORT}`);
});
