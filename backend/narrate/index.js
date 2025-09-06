
const express = require('express');
const cors = require('cors');
const { ElevenLabsClient } = require('elevenlabs');
const { Storage } = require('@google-cloud/storage');

const app = express();
app.use(express.json());
app.use(cors());

// --- CLIENT INITIALIZATION ---
// IMPORTANT: Set ELEVENLABS_API_KEY as an environment variable in your Cloud Run service
const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});
const storage = new Storage();
const bucketName = 'oneminute-movie-in';

/**
 * POST /narrate
 * Generates narration from a script and saves it to GCS.
 *
 * Request Body:
 * {
 *   "projectId": "string",
 *   "narrationScript": "The full text to be narrated."
 * }
 *
 * Response:
 * {
 *   "gsAudioPath": "gs://bucket-name/project-id/narration.mp3"
 * }
 */
app.post('/narrate', async (req, res) => {
  const { projectId, narrationScript } = req.body;

  if (!projectId || !narrationScript) {
    return res.status(400).json({ error: 'Missing required fields: projectId and narrationScript' });
  }

  if (!process.env.ELEVENLABS_API_KEY) {
    console.error('ELEVENLABS_API_KEY environment variable not set.');
    return res.status(500).json({ error: 'Server configuration error: Missing API key for narration service.' });
  }
  
  console.log(`Received narration request for projectId: ${projectId}`);

  try {
    // 1. Generate audio stream from ElevenLabs
    const audioStream = await elevenlabs.generate({
      voice: "Rachel", // You can parameterize this with voiceId if needed
      model_id: "eleven_multilingual_v2",
      text: narrationScript,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    });

    // 2. Stream the audio directly to Google Cloud Storage
    const bucket = storage.bucket(bucketName);
    const fileName = `${projectId}/narration.mp3`;
    const file = bucket.file(fileName);
    const writeStream = file.createWriteStream({
      metadata: { contentType: 'audio/mpeg' },
    });

    // Pipe the audio stream to the GCS write stream
    audioStream.pipe(writeStream);

    // Wait for the stream to finish writing
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    const gcsPath = `gs://${bucketName}/${fileName}`;
    console.log(`Successfully uploaded narration for ${projectId} to ${gcsPath}`);

    res.status(200).json({ gsAudioPath: gcsPath });

  } catch (error) {
    console.error(`Error generating narration for projectId ${projectId}:`, error);
    res.status(500).json({ error: 'Failed to generate narration.', details: error.message });
  }
});

// Note: No music generation endpoint is included here as per the latest stable implementation.

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Narration service listening on port ${PORT}`);
});
