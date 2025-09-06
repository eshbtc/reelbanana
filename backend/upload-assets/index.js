// Fix: Implement the missing 'upload-assets' backend service.
const express = require('express');
const cors = require('cors');
const { Storage } = require('@google-cloud/storage');

const app = express();
app.use(express.json({ limit: '50mb' })); // Increased limit for base64 images
app.use(cors());

// --- CLIENT INITIALIZATION ---
const storage = new Storage();
const bucketName = 'oneminute-movie-in';

/**
 * POST /upload
 * Uploads image assets for a movie project to Google Cloud Storage.
 *
 * Request Body:
 * {
 *   "projectId": "string", // Unique identifier for the movie project
 *   "images": [
 *      {
 *          "sceneIndex": number,
 *          "imageIndex": number,
 *          "base64Data": "string" // base64 encoded image data, without the data URI prefix
 *      }
 *   ]
 * }
 *
 * Response:
 * {
 *   "message": "string",
 *   "uploadedFiles": ["gs://bucket/project/file1.jpeg", ...]
 * }
 */
app.post('/upload', async (req, res) => {
    const { projectId, images } = req.body;

    if (!projectId || !images || !Array.isArray(images) || images.length === 0) {
        return res.status(400).json({ error: 'Missing required fields: projectId and a non-empty images array.' });
    }

    console.log(`Received asset upload request for projectId: ${projectId} with ${images.length} images.`);

    try {
        const bucket = storage.bucket(bucketName);
        const uploadPromises = images.map(image => {
            const { sceneIndex, imageIndex, base64Data } = image;
            
            if (typeof sceneIndex !== 'number' || typeof imageIndex !== 'number' || !base64Data) {
                console.warn(`[${projectId}] Skipping invalid image object:`, image);
                return Promise.resolve(null);
            }

            const buffer = Buffer.from(base64Data, 'base64');
            const fileName = `${projectId}/scene-${sceneIndex}-${imageIndex}.jpeg`;
            const file = bucket.file(fileName);

            return file.save(buffer, {
                metadata: { contentType: 'image/jpeg' },
            }).then(() => `gs://${bucketName}/${fileName}`);
        });
        
        const results = await Promise.all(uploadPromises);
        const uploadedFiles = results.filter(r => r !== null);

        console.log(`Successfully uploaded ${uploadedFiles.length} images for ${projectId}`);

        res.status(200).json({ 
            message: `Successfully uploaded ${uploadedFiles.length} assets.`,
            uploadedFiles: uploadedFiles
        });

    } catch (error) {
        console.error(`Error uploading assets for projectId ${projectId}:`, error);
        res.status(500).json({ error: 'Failed to upload assets.', details: error.message });
    }
});

const PORT = process.env.PORT || 8083; // Use a different port
app.listen(PORT, () => {
    console.log(`Upload-assets service listening on port ${PORT}`);
});
