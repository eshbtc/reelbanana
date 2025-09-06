const express = require('express');
const cors = require('cors');
const { Storage } = require('@google-cloud/storage');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(express.json());
app.use(cors());

const storage = new Storage();
const bucketName = 'oneminute-movie-in';

// IMPORTANT: Set GEMINI_API_KEY as environment variable
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: "gemini-pro" });

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
app.post('/compose-music', async (req, res) => {
  const { projectId, narrationScript } = req.body;

  if (!projectId || !narrationScript) {
    return res.status(400).json({ error: 'Missing required fields: projectId and narrationScript' });
  }

  if (!process.env.GEMINI_API_KEY) {
    console.error('Missing environment variable: GEMINI_API_KEY');
    return res.status(500).json({ error: 'Server configuration error: Missing API key for music service.' });
  }

  console.log(`Received music composition request for projectId: ${projectId}`);

  try {
    // 1. Analyze narration mood with Gemini
    const prompt = `Analyze the following narration script and provide a short, descriptive musical prompt (e.g., "An upbeat, whimsical, adventurous orchestral score for a children's story, with a sense of wonder and a triumphant finish."). Only return the prompt text, nothing else. Script: "${narrationScript}"`;
    const result = await geminiModel.generateContent(prompt);
    const response = await result.response;
    const musicPrompt = response.text().trim();
    console.log(`Generated music prompt: "${musicPrompt}"`);

    // 2. For hackathon demo, create a placeholder audio file
    // In production, you would use a music generation API here
    const bucket = storage.bucket(bucketName);
    const fileName = `${projectId}/music.mp3`;
    const file = bucket.file(fileName);
    
    // Create a simple audio file (placeholder - in production, use actual music generation)
    const audioBuffer = createPlaceholderAudio(musicPrompt);
    
    await file.save(audioBuffer, {
      metadata: { contentType: 'audio/mpeg' },
    });

    const gsMusicPath = `gs://${bucketName}/${fileName}`;
    console.log(`Successfully created music for ${projectId} at ${gsMusicPath}`);

    res.status(200).json({ 
      gsMusicPath: gsMusicPath,
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

const PORT = process.env.PORT || 8084;
app.listen(PORT, () => {
  console.log(`Music composition service listening on port ${PORT}`);
});