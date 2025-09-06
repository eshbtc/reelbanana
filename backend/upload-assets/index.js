const express = require('express');
const cors = require('cors');
const { Storage } = require('@google-cloud/storage');
const admin = require('firebase-admin');

const app = express();
app.use(express.json({ limit: '10mb' })); // Limit for a single base64 image
app.use(cors());

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
    res.status(401);
    return res.json({ error: 'App Check token required' });
  }

  try {
    const appCheckClaims = await admin.appCheck().verifyToken(appCheckToken);
    req.appCheckClaims = appCheckClaims;
    return next();
  } catch (err) {
    console.error('App Check verification failed:', err);
    res.status(401);
    return res.json({ error: 'Invalid App Check token' });
  }
};

const storage = new Storage();
const bucketName = process.env.INPUT_BUCKET_NAME || 'oneminute-movie-in';

/**
 * POST /upload-image
 * Receives a single base64 image and its desired filename, then uploads to GCS.
 *
 * Request Body:
 * {
 *   "projectId": "string",
 *   "fileName": "scene-0-0.jpeg",
 *   "base64Image": "data:image/jpeg;base64,..."
 * }
 *
 * Response:
 * {
 *   "message": "Image uploaded successfully."
 *   "gcsPath": "gs://oneminute-movie-in/projectId/fileName"
 * }
 */
app.post('/upload-image', appCheckVerification, async (req, res) => {
  const { projectId, fileName, base64Image } = req.body;

  if (!projectId || !fileName || !base64Image) {
    return res.status(400).json({ error: 'Missing required fields: projectId, fileName, and base64Image.' });
  }

  try {
    const bucket = storage.bucket(bucketName);
    
    const fullPath = `${projectId}/${fileName}`;
    const file = bucket.file(fullPath);
    
    const base64Data = base64Image.replace(/^data:image\/jpeg;base64,/, "");
    const imageBuffer = Buffer.from(base64Data, 'base64');
    
    await file.save(imageBuffer, {
      metadata: { contentType: 'image/jpeg' },
    });

    const gcsPath = `gs://${bucketName}/${fullPath}`;
    console.log(`Successfully uploaded ${fileName} for ${projectId}.`);
    res.status(200).json({ 
        message: 'Image uploaded successfully.',
        gcsPath: gcsPath
    });

  } catch (error) {
    console.error(`Error uploading image for projectId ${projectId}:`, error);
    res.status(500).json({ error: 'Failed to upload image.', details: error.message });
  }
});

const PORT = process.env.PORT || 8083;
app.listen(PORT, () => {
  console.log(`Upload-assets service listening on port ${PORT}`);
});