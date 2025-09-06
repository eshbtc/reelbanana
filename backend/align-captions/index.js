const express = require('express');
const cors = require('cors');
const { SpeechClient } = require('@google-cloud/speech');
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

// --- CLIENT INITIALIZATION ---
const speechClient = new SpeechClient();
const storage = new Storage();
const bucketName = process.env.INPUT_BUCKET_NAME || 'oneminute-movie-in';

// --- HELPER FUNCTIONS ---

/**
 * Converts a total number of seconds into SRT timestamp format (HH:MM:SS,mmm).
 * @param {number} totalSeconds The time in seconds.
 * @returns {string} The formatted timestamp.
 */
const toSrtTime = (totalSeconds) => {
  if (isNaN(totalSeconds) || totalSeconds < 0) return '00:00:00,000';
  const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
  const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
  const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
  const milliseconds = Math.round((totalSeconds - Math.floor(totalSeconds)) * 1000).toString().padStart(3, '0');
  return `${hours}:${minutes}:${seconds},${milliseconds}`;
};

/**
 * Converts Google Speech-to-Text word-level results into an SRT formatted string.
 * @param {object[]} words The array of word objects from the API.
 * @returns {string} The SRT content.
 */
const convertToSrt = (words) => {
  if (!words || words.length === 0) {
    return '';
  }

  let srtContent = '';
  let line = '';
  // Ensure startTime is valid before processing
  let firstWord = words[0];
  let lineStartTime = (firstWord.startTime?.seconds || 0) + ((firstWord.startTime?.nanos || 0) / 1e9);
  
  let lineEndTime = 0;
  let captionIndex = 1;
  const MAX_WORDS_PER_LINE = 8; // Adjust for desired subtitle length

  words.forEach((wordInfo, index) => {
    if (!wordInfo.startTime || !wordInfo.endTime) return; // Skip words with no timing info
    
    line += wordInfo.word + ' ';

    // Create a subtitle entry when the line is full or it's the last word
    if (line.trim().split(' ').length >= MAX_WORDS_PER_LINE || index === words.length - 1) {
      lineEndTime = (wordInfo.endTime.seconds || 0) + ((wordInfo.endTime.nanos || 0) / 1e9);
      
      srtContent += `${captionIndex}\n`;
      srtContent += `${toSrtTime(lineStartTime)} --> ${toSrtTime(lineEndTime)}\n`;
      srtContent += `${line.trim()}\n\n`;

      // Reset for the next line
      captionIndex++;
      line = '';
      if (index < words.length - 1) {
          const nextWord = words[index + 1];
          if (nextWord.startTime) {
            lineStartTime = (nextWord.startTime.seconds || 0) + ((nextWord.startTime.nanos || 0) / 1e9);
          }
      }
    }
  });

  return srtContent;
};


/**
 * POST /align
 * Generates an SRT file from an audio file in GCS.
 *
 * Request Body:
 * {
 *   "projectId": "string",
 *   "gsAudioPath": "gs://bucket-name/project-id/narration.mp3"
 * }
 *
 * Response:
 * {
 *   "srtPath": "gs://bucket-name/project-id/captions.srt"
 * }
 */
app.post('/align', appCheckVerification, async (req, res) => {
    const { projectId, gsAudioPath } = req.body;

    if (!projectId || !gsAudioPath) {
        return res.status(400).json({ error: 'Missing required fields: projectId and gsAudioPath' });
    }

    console.log(`Received caption alignment request for projectId: ${projectId}`);

    try {
        const request = {
            audio: { uri: gsAudioPath },
            config: {
                encoding: 'MP3',
                sampleRateHertz: 44100, // Matching ElevenLabs output
                languageCode: 'en-US',
                enableWordTimeOffsets: true,
            },
        };

        // 1. Transcribe audio using Google Speech-to-Text
        const [response] = await speechClient.recognize(request);
        const words = response.results.flatMap(result => result.alternatives[0].words);

        if (!words || words.length === 0) {
            throw new Error("Speech-to-Text returned no words.");
        }
        
        // 2. Convert transcription to SRT format
        const srtContent = convertToSrt(words);
        
        // 3. Upload SRT file to Google Cloud Storage
        const bucket = storage.bucket(bucketName);
        const fileName = `${projectId}/captions.srt`;
        const file = bucket.file(fileName);
        
        await file.save(srtContent, { metadata: { contentType: 'text/plain' } });

        const gcsPath = `gs://${bucketName}/${fileName}`;
        console.log(`Successfully uploaded captions for ${projectId} to ${gcsPath}`);

        res.status(200).json({ srtPath: gcsPath });

    } catch (error) {
        console.error(`Error aligning captions for projectId ${projectId}:`, error);
        res.status(500).json({ error: 'Failed to align captions.', details: error.message });
    }
});


const PORT = process.env.PORT || 8081; // Use a different port than narrate service
app.listen(PORT, () => {
  console.log(`Align-captions service listening on port ${PORT}`);
});
