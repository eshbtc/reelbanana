const express = require('express');
const cors = require('cors');
const { Storage } = require('@google-cloud/storage');

const app = express();
// Increase the body limit to handle base64 image uploads
app.use(express.json({ limit: '50mb' }));
app.use(cors());

const storage = new Storage();
const bucketName = 'oneminute-movie-in';

/**
 * POST /upload
 * Receives scene images as base64 strings and uploads them to GCS.
 *
 * Request Body:
 * {
 *   "projectId": "string",
 *   "scenes": [
 *     {
 *       "sceneIndex": number,
 *       "images": ["data:image/jpeg;base64,...", ...]
 *     },
 *     ...
 *   ]
 * }
 *
 * Response:
 * {
 *   "message": "Assets uploaded successfully."
 * }
 */
app.post('/upload', async (req, res) => {
  const { projectId, scenes } = req.body;
  if (!projectId || !scenes || !Array.isArray(scenes)) {
    return res.status(400).json({ error: 'Missing projectId or scenes array.' });
  }

  console.log(`Received asset upload request for projectId: ${projectId}`);

  try {
    const bucket = storage.bucket(bucketName);
    const uploadPromises = [];

    scenes.forEach((scene, sceneIndex) => {
      if (scene.images && Array.isArray(scene.images)) {
        scene.images.forEach((base64Image, imageIndex) => {
          // Filename format must match what the render service expects: scene-INDEX-SEQUENCE.jpeg
          const fileName = `${projectId}/scene-${sceneIndex}-${imageIndex}.jpeg`;
          const file = bucket.file(fileName);
          
          // Strip metadata (e.g., "data:image/jpeg;base64,") from the base64 string
          const base64Data = base64Image.replace(/^data:image\/jpeg;base64,/, "");
          const imageBuffer = Buffer.from(base64Data, 'base64');
          
          const promise = file.save(imageBuffer, {
            metadata: { contentType: 'image/jpeg' },
          });
          uploadPromises.push(promise);
        });
      }
    });

    await Promise.all(uploadPromises);

    console.log(`Successfully uploaded ${uploadPromises.length} images for ${projectId}.`);
    res.status(200).json({ message: 'Assets uploaded successfully.' });

  } catch (error) {
    console.error(`Error uploading assets for projectId ${projectId}:`, error);
    res.status(500).json({ error: 'Failed to upload assets.', details: error.message });
  }
});

const PORT = process.env.PORT || 8083; // Use a different port than other services
app.listen(PORT, () => {
  console.log(`Upload-assets service listening on port ${PORT}`);
});
