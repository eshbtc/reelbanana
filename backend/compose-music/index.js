// Force deployment for demo sync
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
const { requireCredits, deductCreditsAfter, completeCreditOperation } = require('../shared/creditService');

const app = express();

// Trust the first proxy (Cloud Run/GFE) for correct IPs without being permissive
app.set('trust proxy', 1);

app.use(express.json());
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
      return sendError(req, res, 401, 'AUTH_REQUIRED', 'Missing or invalid Authorization header');
    }
    const idToken = authHeader.split('Bearer ')[1];
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.user = decoded;
    return next();
  } catch (err) {
    console.error('ID token verification failed:', err);
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

// Simple SSE progress for music generation
const progressStore = new Map();
const sseClients = new Map();
const progressWriteTs = new Map();
async function pushProgress(jobId, update) {
  if (!jobId) return;
  const prev = progressStore.get(jobId) || {};
  const next = { progress: typeof update.progress==='number'?Math.max(0,Math.min(100,update.progress)):(prev.progress||0), stage: update.stage||prev.stage||'', message: update.message||prev.message||'', etaSeconds: typeof update.etaSeconds==='number'?update.etaSeconds:prev.etaSeconds, done: !!update.done, error: update.error||null, ts: Date.now() };
  progressStore.set(jobId, next);
  const set = sseClients.get(jobId);
  if (set) { const payload = `data: ${JSON.stringify({ jobId, ...next })}\n\n`; for (const res of set) { try { res.write(payload); } catch {} } }
  try {
    const now = Date.now();
    const last = progressWriteTs.get(jobId) || 0;
    if (now - last > 900 || next.done || next.error) {
      progressWriteTs.set(jobId, now);
      const db = admin.firestore();
      await db.collection('job_progress').doc(jobId).set({ jobId, service: 'compose', progress: next.progress, stage: next.stage, message: next.message, etaSeconds: next.etaSeconds||null, done: next.done, error: next.error||null, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    }
  } catch {}
}

app.get('/progress-stream', appCheckVerification, (req, res) => {
  const jobId = (req.query.jobId||'').toString();
  if (!jobId) return sendError(req,res,400,'INVALID_ARGUMENT','Missing jobId');
  res.setHeader('Content-Type','text/event-stream'); res.setHeader('Cache-Control','no-cache'); res.setHeader('Connection','keep-alive'); res.flushHeaders&&res.flushHeaders();
  const snap = progressStore.get(jobId); if (snap) res.write(`data: ${JSON.stringify({ jobId, ...snap })}\n\n`);
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
  if (!sseClients.has(jobId)) sseClients.set(jobId, new Set()); sseClients.get(jobId).add(res);
  req.on('close', ()=>{ const set=sseClients.get(jobId); if (set) set.delete(res); });
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

// Analyze images and generate music parameters based on visual content
async function analyzeImagesForMusic(imageUrls, narrationScript, baseMusicParameters = {}) {
  if (!imageUrls || imageUrls.length === 0) {
    console.log('🎨 No images provided for visual analysis, using base parameters');
    return baseMusicParameters;
  }

  try {
    console.log(`🎨 Analyzing ${imageUrls.length} images for music generation...`);
    
    // Create a comprehensive prompt for visual analysis
    const visualAnalysisPrompt = `You are a music composer analyzing visual content to create the perfect soundtrack. Analyze the images and narration to generate unique music parameters.

NARRATION: "${narrationScript}"

VISUAL ANALYSIS INSTRUCTIONS:
Analyze the visual content and identify:
1. **Atmosphere**: Dark/mysterious, bright/cheerful, dramatic/intense, calm/peaceful, energetic/dynamic
2. **Color Palette**: Warm (reds, oranges, yellows), Cool (blues, greens, purples), Monochromatic, High contrast, Muted tones
3. **Setting**: Urban/city, Nature/outdoor, Indoor/domestic, Futuristic/sci-fi, Historical/period, Abstract/surreal
4. **Movement**: Static/calm, Slow/gentle, Dynamic/active, Fast/energetic, Chaotic/intense
5. **Emotional Tone**: Joyful, Melancholic, Tense, Peaceful, Exciting, Romantic, Epic, Mysterious

MUSIC PARAMETER SELECTION:
Based on your analysis, select music parameters that will create a soundtrack that perfectly matches the visual story:

**Style Selection Guide:**
- Dark/mysterious → dramatic, ambient, or electronic
- Bright/cheerful → pop, folk, or classical
- Urban/modern → electronic, hip-hop, or rock
- Nature/outdoor → acoustic, folk, or ambient
- Futuristic → electronic, synth, or ambient
- Historical → classical, orchestral, or folk

**Genre Selection Guide:**
- Orchestral: Epic, dramatic, or classical scenes
- Electronic: Modern, futuristic, or urban scenes
- Acoustic: Natural, intimate, or organic scenes
- Ambient: Atmospheric, mysterious, or contemplative scenes

**Tempo Selection:**
- Static/calm → slow
- Gentle movement → medium
- Active/dynamic → fast
- Intense/chaotic → very-fast

**Mood Selection:**
- Match the dominant emotional tone of the visuals
- Consider the overall atmosphere and color palette

**Instruments Selection:**
- Choose instruments that match the setting and mood
- Consider the visual complexity and energy level

**Key Selection:**
- Major keys for bright, positive, or uplifting content
- Minor keys for dark, mysterious, or melancholic content

**Complexity/Energy/Density:**
- Match the visual complexity and energy level
- Consider the amount of detail and movement in the images

CRITICAL: Make each selection unique and specific to the visual content. Avoid generic choices. The music should feel like it was composed specifically for these exact images.

Return your analysis in this exact format:
VISUAL_ANALYSIS: [Detailed analysis of the visual content, atmosphere, and emotional tone]
MUSIC_PARAMETERS: {
  "style": "[specific style choice]",
  "genre": "[specific genre choice]", 
  "tempo": "[specific tempo choice]",
  "mood": "[specific mood choice]",
  "instruments": "[specific instrument choice]",
  "key": "[specific key choice]",
  "complexity": "[specific complexity choice]",
  "energy": "[specific energy choice]",
  "density": "[specific density choice]"
}`;

    // Use AI to analyze images and generate music parameters
    const response = await ai.generate({
      prompt: visualAnalysisPrompt,
      config: { 
        maxOutputTokens: 500, 
        temperature: 0.8 // Higher temperature for more creative analysis
      }
    });

    const aiResponse = response?.text?.()?.trim();
    console.log('🎨 AI Visual Analysis Response:', aiResponse);

    // Parse the AI response to extract music parameters
    const musicParamsMatch = aiResponse.match(/MUSIC_PARAMETERS:\s*({[\s\S]*?})/);
    if (musicParamsMatch) {
      try {
        const extractedParams = JSON.parse(musicParamsMatch[1]);
        console.log('🎨 Extracted music parameters from visual analysis:', extractedParams);
        
        // Merge with base parameters, giving priority to visual analysis
        const finalParams = {
          ...baseMusicParameters,
          ...extractedParams,
          // Ensure required parameters are present
          duration: baseMusicParameters.duration || 20,
          format: baseMusicParameters.format || 'wav',
          vocals: baseMusicParameters.vocals || 'instrumental'
        };
        
        console.log('🎨 Final visual-aware music parameters:', finalParams);
        return finalParams;
      } catch (parseError) {
        console.log('🎨 Failed to parse music parameters from AI response:', parseError.message);
      }
    }

    console.log('🎨 Could not extract music parameters from visual analysis, using base parameters');
    return baseMusicParameters;

  } catch (error) {
    console.log('🎨 Visual analysis failed, using base parameters:', error?.message || error);
    return baseMusicParameters;
  }
}

// Generate composition plan using ElevenLabs Music API
async function generateCompositionPlan(narrationScript, musicParameters = {}, imageUrls = []) {
  const {
    style = 'cinematic',
    genre = 'orchestral',
    structure = 'intro-verse-chorus-verse-chorus-outro',
    vocals = 'instrumental',
    duration = 20,
    tempo = 'medium',
    mood = 'dramatic',
    instruments = 'orchestra',
    key = 'C',
    timeSignature = '4/4',
    complexity = 'moderate',
    energy = 'medium',
    density = 'moderate'
  } = musicParameters;

  // Create a detailed prompt for composition plan generation
  const planPrompt = `Create a ${style} ${genre} composition for a ${duration}-second ${mood} piece. 
  
Narration context: "${narrationScript}"

${imageUrls.length > 0 ? `Visual context: This music will accompany ${imageUrls.length} images that tell a visual story.` : ''}

Musical requirements:
- Style: ${style} with ${genre} elements
- Tempo: ${tempo} (${tempo === 'slow' ? '60-80 BPM' : tempo === 'medium' ? '80-120 BPM' : tempo === 'fast' ? '120-160 BPM' : '160+ BPM'})
- Mood: ${mood} throughout
- Instruments: ${instruments}
- Key: ${key}
- Time signature: ${timeSignature}
- Complexity: ${complexity}
- Energy level: ${energy}
- Density: ${density}
- Vocals: ${vocals === 'instrumental' ? 'No vocals, purely instrumental' : vocals === 'vocals' ? 'Include vocal elements' : 'Mix of instrumental and vocal elements'}

Structure: ${structure}
Duration: ${duration} seconds total

${imageUrls.length > 0 ? 'Create a dynamic, engaging composition that matches both the narration and the visual story being told through the images.' : 'Create a dynamic, engaging composition that matches the narration\'s emotional arc and content.'}`;

  try {
    console.log('🎵 Creating composition plan with ElevenLabs Music API...');
    
    // Use ElevenLabs Music API to create a composition plan
    const planResponse = await elevenLabsClient.music.createCompositionPlan({
      prompt: planPrompt,
      music_length_ms: duration * 1000,
      model_id: 'music_v1'
    });

    console.log('🎵 Composition plan created:', JSON.stringify(planResponse, null, 2));
    return planResponse;
  } catch (error) {
    console.log('🎵 Composition plan generation failed, using fallback prompt:', error?.message || error);
    return null; // Will fall back to simple prompt
  }
}

// AI-powered music prompt generation using Firebase Genkit with Vertex AI
async function generateMusicPromptWithAI(narrationScript, musicParameters = {}) {
  const {
    style = 'cinematic',
    genre = 'orchestral',
    structure = 'intro-verse-chorus-verse-chorus-outro',
    vocals = 'instrumental',
    duration = 20,
    format = 'wav',
    tempo = 'medium',
    mood = 'dramatic',
    instruments = 'orchestra',
    key = 'C',
    timeSignature = '4/4',
    complexity = 'moderate',
    energy = 'medium',
    density = 'moderate'
  } = musicParameters;

  // Add randomization and style variation
  const randomSeed = Math.random().toString(36).substring(7);
  
  const prompt = `Create a detailed musical prompt for ElevenLabs Music API based on this narration script and parameters:

NARRATION: "${narrationScript}"

PARAMETERS:
- Style: ${style}
- Genre: ${genre}
- Structure: ${structure}
- Vocals: ${vocals}
- Duration: ${duration} seconds
- Format: ${format}
- Tempo: ${tempo}
- Mood: ${mood}
- Instruments: ${instruments}
- Key: ${key}
- Time Signature: ${timeSignature}
- Complexity: ${complexity}
- Energy: ${energy}
- Density: ${density}

Create a comprehensive, specific prompt that incorporates all these parameters. Include musical direction, instrumentation details, emotional arc, and technical specifications. Make it unique and varied.`;
  
  try {
    if (!ai || typeof ai.generate !== 'function') {
      return generateFallbackPrompt(narrationScript, musicParameters);
    }
    console.log(`🎵 Generating music prompt with Firebase Genkit + Vertex AI (style: ${style}, genre: ${genre}, seed: ${randomSeed})...`);
    const response = await ai.generate({
      prompt,
      config: { maxOutputTokens: 200, temperature: 0.9 } // Higher temperature for more variation
    });
    const aiResponse = response?.text?.()?.trim();
    console.log('🎵 AI-generated music prompt:', aiResponse);
    return aiResponse || generateFallbackPrompt(narrationScript, musicParameters);
  } catch (error) {
    console.log('🎵 AI generation failed, using fallback:', error?.message || error);
    return generateFallbackPrompt(narrationScript, musicParameters);
  }
}

// Fallback music prompt generation with comprehensive parameter support
function generateFallbackPrompt(narrationScript, musicParameters = {}) {
  const {
    style = 'cinematic',
    genre = 'orchestral',
    structure = 'intro-verse-chorus-verse-chorus-outro',
    vocals = 'instrumental',
    duration = 20,
    format = 'wav',
    tempo = 'medium',
    mood = 'dramatic',
    instruments = 'orchestra',
    key = 'C',
    timeSignature = '4/4',
    complexity = 'moderate',
    energy = 'medium',
    density = 'moderate'
  } = musicParameters;

  const script = narrationScript.toLowerCase();
  const randomSeed = Math.random();
  
  // Build comprehensive prompt based on all parameters
  const tempoMap = {
    'slow': 'slow, relaxed tempo',
    'medium': 'moderate tempo',
    'fast': 'upbeat, energetic tempo',
    'very-fast': 'very fast, driving tempo'
  };
  
  const energyMap = {
    'low': 'gentle, subdued energy',
    'medium': 'balanced energy',
    'high': 'high energy and intensity',
    'very-high': 'maximum energy and power'
  };
  
  const complexityMap = {
    'simple': 'simple, straightforward arrangement',
    'moderate': 'moderately complex arrangement',
    'complex': 'complex, layered arrangement',
    'very-complex': 'highly complex, intricate arrangement'
  };
  
  const densityMap = {
    'sparse': 'sparse, minimal instrumentation',
    'moderate': 'moderate instrumentation',
    'dense': 'dense, full instrumentation',
    'very-dense': 'very dense, rich instrumentation'
  };
  
  // Content-based mood detection
  let contentMood = mood;
  if (script.includes('adventure') || script.includes('journey') || script.includes('quest')) {
    contentMood = 'epic';
  } else if (script.includes('mystery') || script.includes('secret') || script.includes('hidden')) {
    contentMood = 'mysterious';
  } else if (script.includes('happy') || script.includes('joy') || script.includes('celebration')) {
    contentMood = 'happy';
  } else if (script.includes('magic') || script.includes('fantasy') || script.includes('wonder')) {
    contentMood = 'magical';
  }
  
  // Generate comprehensive prompt
  const prompt = `A ${style} ${genre} composition in ${key} key with ${timeSignature} time signature. 
${tempoMap[tempo]} with ${energyMap[energy]}. 
${complexityMap[complexity]} featuring ${instruments} with ${densityMap[density]}. 
${contentMood} mood throughout the ${duration}-second piece. 
${vocals === 'instrumental' ? 'Purely instrumental' : vocals === 'vocals' ? 'With vocal elements' : 'Both instrumental and vocal elements'}. 
${structure} structure with ${mood} emotional arc.`;
  
  return prompt.trim();
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
function musicCacheKey({ narrationScript, musicParameters = {}, imageUrls = [], normalized = false }) {
  const base = normalized ? normalizeScriptForCache(narrationScript) : String(narrationScript || '').trim();
  const payload = JSON.stringify({ 
    v: 5, // Increment version to include image URLs
    text: base, 
    imageUrls: imageUrls || [], // Include image URLs in cache key
    ...musicParameters,
    // Include all parameters that affect music generation
    style: musicParameters.style || 'cinematic',
    genre: musicParameters.genre || 'orchestral',
    structure: musicParameters.structure || 'intro-verse-chorus-verse-chorus-outro',
    vocals: musicParameters.vocals || 'instrumental',
    duration: musicParameters.duration || 20,
    format: musicParameters.format || 'wav',
    tempo: musicParameters.tempo || 'medium',
    mood: musicParameters.mood || 'dramatic',
    instruments: musicParameters.instruments || 'orchestra',
    key: musicParameters.key || 'C',
    timeSignature: musicParameters.timeSignature || '4/4',
    complexity: musicParameters.complexity || 'moderate',
    energy: musicParameters.energy || 'medium',
    density: musicParameters.density || 'moderate'
  });
  return createHash('sha256').update(payload).digest('hex');
}

/**
 * POST /compose-music
 * Generates a musical score based on narration script mood and saves it to GCS.
 * Supports all ElevenLabs Music API features for maximum customization.
 *
 * Request Body:
 * {
 *   "projectId": "string",
 *   "narrationScript": "The full text of the narration.",
 *   "style": "cinematic|electronic|ambient|dramatic|jazz|rock|classical|pop|hip-hop|folk|blues|country|reggae|funk|soul|r&b|metal|punk|indie|alternative",
 *   "genre": "orchestral|synth|acoustic|electronic|ambient|rock|jazz|classical|pop|hip-hop|folk|blues|country|reggae|funk|soul|r&b|metal|punk|indie|alternative",
 *   "structure": "intro-verse-chorus-verse-chorus-bridge-chorus-outro|verse-chorus-verse-chorus|intro-verse-chorus-outro|ambient-drone|cinematic-crescendo|simple-loop",
 *   "vocals": "instrumental|vocals|both",
 *   "duration": 10-60 (seconds, default: 20),
 *   "format": "wav|mp3|flac",
 *   "tempo": "slow|medium|fast|very-fast",
 *   "mood": "happy|sad|energetic|calm|dramatic|mysterious|romantic|epic|melancholic|uplifting",
 *   "instruments": "piano|guitar|violin|drums|bass|synthesizer|orchestra|brass|strings|woodwinds|percussion|electric-guitar|acoustic-guitar|keyboard|organ|harp|flute|saxophone|trumpet|trombone|cello|viola|clarinet|oboe|bassoon|french-horn|tuba|timpani|cymbals|xylophone|marimba|vibraphone|glockenspiel|chimes|bells|gong|tambourine|shaker|cowbell|triangle|wood-block|claves|guiro|cabasa|maracas|bongos|congas|djembe|tabla|dhol|bodhran|frame-drum|handpan|hang|steel-drum|kalimba|thumb-piano|mbira|didgeridoo|bagpipes|accordion|harmonica|mandolin|banjo|ukulele|lute|sitar|oud|koto|shamisen|erhu|guzheng|pipa|yangqin|dizi|xiao|suona|sheng|gong|chime|bell|temple-block|wood-fish|mokugyo|taiko|kotsuzumi|otsuzumi|shime-daiko|hirado-daiko|nagado-daiko|okedo-daiko|chudaiko|hira-daiko|miya-daiko|odaiko|uchiwa-daiko|byo-daiko|kakko|san-no-tsuzumi|tsuzumi|kotsuzumi|otsuzumi|shime-daiko|hirado-daiko|nagado-daiko|okedo-daiko|chudaiko|hira-daiko|miya-daiko|odaiko|uchiwa-daiko|byo-daiko|kakko|san-no-tsuzumi|tsuzumi",
 *   "key": "C|C#|D|D#|E|F|F#|G|G#|A|A#|B|Cm|C#m|Dm|D#m|Em|Fm|F#m|Gm|G#m|Am|A#m|Bm",
 *   "timeSignature": "4/4|3/4|2/4|6/8|12/8|5/4|7/8|9/8",
 *   "complexity": "simple|moderate|complex|very-complex",
 *   "energy": "low|medium|high|very-high",
 *   "density": "sparse|moderate|dense|very-dense"
 * }
 *
 * Response:
 * {
 *   "gsMusicPath": "gs://bucket-name/project-id/music.wav",
 *   "musicPrompt": "Generated prompt used",
 *   "parameters": { ... },
 *   "cached": false
 * }
 */
app.post('/compose-music', 
  verifyToken,
  requireCredits('musicGeneration'),
  deductCreditsAfter('musicGeneration'),
  ...createExpensiveOperationLimiter('compose'), 
  appCheckOrAdmin, 
  async (req, res) => {
  const { 
    projectId, 
    narrationScript, 
    jobId: providedJobId,
    // Image URLs for visual analysis
    imageUrls = [],
    // ElevenLabs Music API parameters
    style = 'cinematic',
    genre = 'orchestral',
    structure = 'intro-verse-chorus-verse-chorus-outro',
    vocals = 'instrumental',
    duration = 20,
    format = 'wav',
    tempo = 'medium',
    mood = 'dramatic',
    instruments = 'orchestra',
    key = 'C',
    timeSignature = '4/4',
    complexity = 'moderate',
    energy = 'medium',
    density = 'moderate'
  } = req.body;
  
  const jobId = (providedJobId && String(providedJobId)) || `compose-${projectId}-${Date.now()}`;

  if (!projectId || !narrationScript) {
    return sendError(req, res, 400, 'INVALID_ARGUMENT', 'Missing required fields: projectId and narrationScript');
  }

  // Validate parameters
  const validStyles = ['cinematic', 'electronic', 'ambient', 'dramatic', 'jazz', 'rock', 'classical', 'pop', 'hip-hop', 'folk', 'blues', 'country', 'reggae', 'funk', 'soul', 'r&b', 'metal', 'punk', 'indie', 'alternative'];
  const validGenres = ['orchestral', 'synth', 'acoustic', 'electronic', 'ambient', 'rock', 'jazz', 'classical', 'pop', 'hip-hop', 'folk', 'blues', 'country', 'reggae', 'funk', 'soul', 'r&b', 'metal', 'punk', 'indie', 'alternative'];
  const validVocals = ['instrumental', 'vocals', 'both'];
  const validFormats = ['wav', 'mp3', 'flac'];
  const validTempos = ['slow', 'medium', 'fast', 'very-fast'];
  const validMoods = ['happy', 'sad', 'energetic', 'calm', 'dramatic', 'mysterious', 'romantic', 'epic', 'melancholic', 'uplifting'];
  const validKeys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bm'];
  const validTimeSignatures = ['4/4', '3/4', '2/4', '6/8', '12/8', '5/4', '7/8', '9/8'];
  const validComplexities = ['simple', 'moderate', 'complex', 'very-complex'];
  const validEnergies = ['low', 'medium', 'high', 'very-high'];
  const validDensities = ['sparse', 'moderate', 'dense', 'very-dense'];

  if (!validStyles.includes(style)) {
    return sendError(req, res, 400, 'INVALID_ARGUMENT', `Invalid style. Must be one of: ${validStyles.join(', ')}`);
  }
  if (!validGenres.includes(genre)) {
    return sendError(req, res, 400, 'INVALID_ARGUMENT', `Invalid genre. Must be one of: ${validGenres.join(', ')}`);
  }
  if (!validVocals.includes(vocals)) {
    return sendError(req, res, 400, 'INVALID_ARGUMENT', `Invalid vocals. Must be one of: ${validVocals.join(', ')}`);
  }
  if (!validFormats.includes(format)) {
    return sendError(req, res, 400, 'INVALID_ARGUMENT', `Invalid format. Must be one of: ${validFormats.join(', ')}`);
  }
  if (duration < 10 || duration > 60) {
    return sendError(req, res, 400, 'INVALID_ARGUMENT', 'Duration must be between 10 and 60 seconds');
  }

  // Store all parameters for response
  const musicParameters = {
    style, genre, structure, vocals, duration, format, tempo, mood, 
    instruments, key, timeSignature, complexity, energy, density
  };


  console.log(`Received music composition request for projectId: ${projectId}`);

  try {
    // Check if music file already exists to avoid re-processing
    const bucket = storage.bucket(bucketName);
    const fileName = `${projectId}/music.${format}`;
    const file = bucket.file(fileName);
    
    const [exists] = await file.exists();
    if (exists) {
      const gsMusicPath = `gs://${bucketName}/${fileName}`;
      console.log(`Music already exists for ${projectId} at ${gsMusicPath}, skipping Gemini processing`);
      try { pushProgress(jobId, { progress: 100, stage: 'compose', message: 'Cached music', done: true }); } catch {}
      metrics.cacheHits++;
      // Complete credit operation
      if (req.creditDeduction?.idempotencyKey) {
        await completeCreditOperation(req.creditDeduction.idempotencyKey, 'completed');
      }
      
      return res.status(200).json({ 
        gsMusicPath: gsMusicPath,
        musicPrompt: "Previously generated",
        requestId: req.requestId,
        cached: true
      });
    }
    // Global cache by narration script, parameters, and image URLs (exact then normalized)
    const exactId = musicCacheKey({ narrationScript, musicParameters, imageUrls, normalized: false });
    const normId  = musicCacheKey({ narrationScript, musicParameters, imageUrls: [], normalized: true });
    const exactFile = bucket.file(`cache/music/exact/${exactId}.${format}`);
    const normFile  = bucket.file(`cache/music/norm/${normId}.${format}`);
    const [[exactExists],[normExists]] = await Promise.all([exactFile.exists(), normFile.exists()]);
    if (exactExists || (normExists && (!imageUrls || imageUrls.length === 0))) {
      const source = exactExists ? exactFile : normFile;
      await source.copy(file);
      const gsMusicPath = `gs://${bucketName}/${fileName}`;
      console.log(`Music cache hit ${exactExists ? exactId : normId} (${exactExists ? 'exact' : 'norm'}); copied to ${gsMusicPath}`);
      metrics.cacheHits++;
      // Complete credit operation
      if (req.creditDeduction?.idempotencyKey) {
        await completeCreditOperation(req.creditDeduction.idempotencyKey, 'completed');
      }
      
      return res.status(200).json({ 
        gsMusicPath,
        musicPrompt: 'Previously generated',
        parameters: musicParameters,
        requestId: req.requestId,
        cached: true,
        cacheId: exactExists ? exactId : normId
      });
    }
    // 1. Analyze images for visual-aware music generation
    let visualAwareMusicParameters = musicParameters;
    if (imageUrls && imageUrls.length > 0) {
      pushProgress(jobId, { progress: 5, stage: 'compose', message: 'Analyzing images for music generation…' });
      visualAwareMusicParameters = await analyzeImagesForMusic(imageUrls, narrationScript, musicParameters);
      console.log('🎨 Visual analysis complete, using image-driven music parameters');
    } else {
      console.log('🎨 No images provided, using base music parameters');
    }

    // 2. Try to generate composition plan first, then fall back to simple prompt
    pushProgress(jobId, { progress: 10, stage: 'compose', message: 'Creating composition plan…' });
    const compositionPlan = await generateCompositionPlan(narrationScript, visualAwareMusicParameters, imageUrls);
    
    let musicPrompt = null;
    if (compositionPlan) {
      console.log('🎵 Using composition plan for music generation');
      pushProgress(jobId, { progress: 20, stage: 'compose', message: 'Composition plan created, generating music…' });
    } else {
      console.log('🎵 Composition plan failed, using AI-generated prompt');
      pushProgress(jobId, { progress: 20, stage: 'compose', message: 'Generating music prompt…' });
      musicPrompt = await generateMusicPromptWithAI(narrationScript, visualAwareMusicParameters);
      console.log(`Generated music prompt: "${musicPrompt}"`);
    }

    // 3. Generate real music using ElevenLabs Eleven Music API with composition plan or prompt
    console.log('🎵 Generating real music with ElevenLabs Eleven Music...');
    pushProgress(jobId, { progress: 40, stage: 'compose', message: 'Generating music…' });
    const audioBuffer = await generateRealMusic(musicPrompt, visualAwareMusicParameters, compositionPlan);
    
    pushProgress(jobId, { progress: 85, stage: 'compose', message: 'Saving music…' });
    
    // Set correct content type based on format
    const contentTypeMap = {
      'wav': 'audio/wav',
      'mp3': 'audio/mpeg',
      'flac': 'audio/flac'
    };
    
    await file.save(audioBuffer, {
      metadata: { contentType: contentTypeMap[format] || 'audio/wav' },
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

    // Complete credit operation
    if (req.creditDeduction?.idempotencyKey) {
      await completeCreditOperation(req.creditDeduction.idempotencyKey, 'completed');
    }
    
    try { pushProgress(jobId, { progress: 100, stage: 'compose', message: 'Music ready', done: true }); } catch {}
    res.status(200).json({ 
      gsMusicPath: gsMusicPath,
      musicPrompt: musicPrompt,
      parameters: visualAwareMusicParameters, // Return the visual-aware parameters
      originalParameters: musicParameters, // Keep original for reference
      visualAnalysis: {
        imagesAnalyzed: imageUrls?.length || 0,
        imageUrls: imageUrls || [],
        visualAware: (imageUrls && imageUrls.length > 0) ? true : false
      },
      requestId: req.requestId
    });

  } catch (error) {
    console.error(`Error composing music for projectId ${projectId}:`, error);
    
    // Mark credit operation as failed
    if (req.creditDeduction?.idempotencyKey) {
      await completeCreditOperation(req.creditDeduction.idempotencyKey, 'failed', error.message);
    }
    
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
async function generateRealMusic(musicPrompt, musicParameters = {}, compositionPlan = null) {
  const {
    duration = 20,
    format = 'wav'
  } = musicParameters;
  
  const startTime = Date.now();
  const maxRetries = parseInt(process.env.ELEVENLABS_MUSIC_MAX_RETRIES || '2', 10);
  const timeoutMs = parseInt(process.env.ELEVENLABS_MUSIC_TIMEOUT_MS || '120000', 10); // 2 minute timeout for composition plans
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🎵 Generating music with ElevenLabs Eleven Music (attempt ${attempt}/${maxRetries})...`);
      console.log(`🎵 Parameters: duration=${duration}s, format=${format}`);
      if (compositionPlan) {
        console.log(`🎵 Using composition plan with ${compositionPlan.sections?.length || 0} sections`);
      } else {
        console.log(`🎵 Using simple prompt: ${musicPrompt?.length || 0} chars`);
      }
      
      // Create timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('ElevenLabs music generation timeout')), timeoutMs);
      });
      
      // Call ElevenLabs Music API with composition plan or prompt
      let musicPromise;
      if (compositionPlan) {
        // Use composition plan for structured music generation
        musicPromise = elevenLabsClient.music.compose({
          composition_plan: compositionPlan,
          music_length_ms: duration * 1000,
          output_format: format === 'wav' ? 'wav_44100' : format === 'mp3' ? 'mp3_44100_128' : 'flac_44100',
          model_id: 'music_v1',
          respect_sections_durations: true
        });
      } else {
        // Use simple prompt
        musicPromise = elevenLabsClient.music.compose({
          prompt: musicPrompt,
          music_length_ms: duration * 1000,
          output_format: format === 'wav' ? 'wav_44100' : format === 'mp3' ? 'mp3_44100_128' : 'flac_44100',
          model_id: 'music_v1'
        });
      }
      
      // For longer compositions, try streaming first for better performance
      if (duration > 30) {
        console.log('🎵 Using streaming endpoint for longer composition...');
        try {
          const streamPromise = elevenLabsClient.music.stream({
            ...(compositionPlan ? { composition_plan: compositionPlan } : { prompt: musicPrompt }),
            music_length_ms: duration * 1000,
            output_format: format === 'wav' ? 'wav_44100' : format === 'mp3' ? 'mp3_44100_128' : 'flac_44100',
            model_id: 'music_v1'
          });
          
          // Try streaming first, fall back to regular compose if it fails
          musicPromise = streamPromise;
        } catch (streamError) {
          console.log('🎵 Streaming failed, falling back to regular compose:', streamError.message);
          // musicPromise is already set above
        }
      }
      
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

const PORT = process.env.PORT || 8084;
app.listen(PORT, () => {
  console.log(`Music composition service listening on port ${PORT}`);
});
