const express = require('express');
const cors = require('cors');
const { GoogleGenAI } = require('@google/genai');
const { Storage } = require('@google-cloud/storage');

const app = express();
app.use(express.json());
app.use(cors());

// --- CLIENT INITIALIZATION ---
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const storage = new Storage();
const bucketName = 'oneminute-movie-in';

/**
 * POST /compose-music
 * Generates a musical score prompt and creates a simple audio track.
 *
 * Request Body:
 * {
 *   "projectId": "string",
 *   "narrationScript": "The full narration text to analyze for mood."
 * }
 *
 * Response:
 * {
 *   "gsMusicPath": "gs://bucket-name/project-id/music.mp3"
 * }
 */
app.post('/compose-music', async (req, res) => {
  const { projectId, narrationScript } = req.body;

  if (!projectId || !narrationScript) {
    return res.status(400).json({ error: 'Missing required fields: projectId and narrationScript' });
  }

  if (!process.env.GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY environment variable not set.');
    return res.status(500).json({ error: 'Server configuration error: Missing API key for music composition.' });
  }
  
  console.log(`Received music composition request for projectId: ${projectId}`);

  try {
    // 1. Analyze the narration script for mood and style
    const moodAnalysisPrompt = `
    Analyze this narration script and determine the appropriate musical style and mood:
    
    "${narrationScript}"
    
    Return a JSON object with:
    - mood: the emotional tone (e.g., "adventurous", "mysterious", "uplifting", "dramatic", "whimsical")
    - style: the musical genre (e.g., "orchestral", "electronic", "acoustic", "cinematic")
    - tempo: the pace (e.g., "moderate", "fast", "slow")
    - intensity: the energy level (e.g., "low", "medium", "high")
    
    Format: {"mood": "...", "style": "...", "tempo": "...", "intensity": "..."}
    `;

    const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const moodResult = await model.generateContent(moodAnalysisPrompt);
    const moodAnalysis = JSON.parse(moodResult.response.text().trim());

    // 2. Generate a music composition prompt
    const musicPrompt = `
    Create a ${moodAnalysis.tempo} ${moodAnalysis.style} musical piece with a ${moodAnalysis.mood} mood and ${moodAnalysis.intensity} intensity.
    The music should be suitable for a short video (30-60 seconds) and complement storytelling.
    Focus on creating an emotional atmosphere that matches the narrative tone.
    `;

    console.log(`Generated music prompt: ${musicPrompt}`);

    // 3. For now, we'll create a placeholder audio file
    // In a real implementation, you would use a music generation API here
    // For the hackathon, we'll create a simple tone-based audio file
    
    const bucket = storage.bucket(bucketName);
    const fileName = `${projectId}/music.mp3`;
    const file = bucket.file(fileName);
    
    // Create a simple audio file (placeholder - in production, use actual music generation)
    const audioBuffer = createPlaceholderAudio(moodAnalysis);
    
    await file.save(audioBuffer, {
      metadata: { contentType: 'audio/mpeg' },
    });

    const gcsPath = `gs://${bucketName}/${fileName}`;
    console.log(`Successfully created music for ${projectId} at ${gcsPath}`);

    res.status(200).json({ 
      gsMusicPath: gcsPath,
      moodAnalysis: moodAnalysis,
      musicPrompt: musicPrompt
    });

  } catch (error) {
    console.error(`Error composing music for projectId ${projectId}:`, error);
    res.status(500).json({ error: 'Failed to compose music.', details: error.message });
  }
});

/**
 * Create a placeholder audio file based on mood analysis
 * In production, this would be replaced with actual music generation
 */
function createPlaceholderAudio(moodAnalysis) {
  // This is a simplified placeholder - in reality, you'd use a music generation API
  // For the hackathon demo, we'll create a simple tone sequence
  
  const fs = require('fs');
  const path = require('path');
  
  // Create a simple audio file with different tones based on mood
  let frequency = 440; // Base frequency (A4)
  
  switch (moodAnalysis.mood) {
    case 'adventurous':
      frequency = 523; // C5
      break;
    case 'mysterious':
      frequency = 349; // F4
      break;
    case 'uplifting':
      frequency = 659; // E5
      break;
    case 'dramatic':
      frequency = 392; // G4
      break;
    case 'whimsical':
      frequency = 587; // D5
      break;
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

const PORT = process.env.PORT || 8084;
app.listen(PORT, () => {
  console.log(`Music composition service listening on port ${PORT}`);
});
