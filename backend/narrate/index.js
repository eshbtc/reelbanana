
const express = require('express');
const cors = require('cors');
const { ElevenLabsClient } = require('elevenlabs');
const { Storage } = require('@google-cloud/storage');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cors());

// Validate that required environment variables are set
if (!process.env.ELEVENLABS_API_KEY) {
    console.error("FATAL ERROR: ELEVENLABS_API_KEY environment variable is not set.");
    process.exit(1);
}

// --- CLIENT INITIALIZATION ---
const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});
const storage = new Storage();
const bucketName = 'oneminute-movie-in'; // As defined in your architecture plan

/**
 * POST /narrate
 * Generates audio from text and uploads it to Google Cloud Storage.
 *
 * Request Body:
 * {
 *   "projectId": "string", // Unique identifier for the movie project
 *   "narrationText": "string", // The text to be converted to speech
 *   "voiceId": "string" // Optional: The ElevenLabs voice ID to use
 * }
 *
 * Response:
 * {
 *   "audioPath": "gs://bucket-name/project-id/narration.mp3"
 * }
 */
app.post('/narrate', async (req, res) => {
  const { projectId, narrationText, voiceId } = req.body;

  if (!projectId || !narrationText) {
    return res.status(400).json({ error: 'Missing required fields: projectId and narrationText' });
  }

  console.log(`Received narration request for projectId: ${projectId}`);

  try {
    // 1. Generate Audio Stream from ElevenLabs
    const audioStream = await elevenlabs.generate({
      voice: voiceId || 'Rachel', // A sensible default voice
      text: narrationText,
      model_id: 'eleven_multilingual_v2',
      output_format: 'mp3_44100_128'
    });

    // 2. Upload Stream to Google Cloud Storage
    const bucket = storage.bucket(bucketName);
    const fileName = `${projectId}/narration.mp3`;
    const file = bucket.file(fileName);
    const writeStream = file.createWriteStream({
        metadata: { contentType: 'audio/mpeg' },
    });

    // Pipe the audio stream directly to GCS
    audioStream.pipe(writeStream);

    // 3. Handle successful upload and respond
    await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
    });

    const gcsPath = `gs://${bucketName}/${fileName}`;
    console.log(`Successfully uploaded narration for ${projectId} to ${gcsPath}`);
    
    res.status(200).json({ audioPath: gcsPath });

  } catch (error) {
    console.error(`Error generating narration for projectId ${projectId}:`, error);
    res.status(500).json({ error: 'Failed to generate narration.', details: error.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Narrate service listening on port ${PORT}`);
});
