
const express = require('express');
const cors = require('cors');
const { Storage } = require('@google-cloud/storage');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs/promises');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());

const storage = new Storage();
const inputBucketName = 'oneminute-movie-in';
const outputBucketName = 'oneminute-movie-out';

/**
 * POST /render
 * Orchestrates the entire video rendering process.
 *
 * Request Body:
 * {
 *   "projectId": "string",
 *   "scenes": [ { "narration": "string", "imageCount": number } ],
 *   "gsAudioPath": "gs://...",
 *   "srtPath": "gs://..."
 * }
 * Response:
 * {
 *   "videoUrl": "https://storage.googleapis.com/..."
 * }
 */
app.post('/render', async (req, res) => {
    const { projectId, scenes, gsAudioPath, srtPath } = req.body;

    if (!projectId || !scenes || !gsAudioPath || !srtPath) {
        return res.status(400).json({ error: 'Missing required fields for rendering.' });
    }

    console.log(`Received render request for projectId: ${projectId}`);
    const tempDir = path.join('/tmp', projectId);

    try {
        // 1. Setup: Create a temporary local directory for processing
        await fs.mkdir(tempDir, { recursive: true });

        // 2. Download all necessary assets from GCS
        console.log('Downloading assets...');
        const inputBucket = storage.bucket(inputBucketName);
        const imageFiles = (await inputBucket.getFiles({ prefix: `${projectId}/scene-` }))[0];
        
        await Promise.all([
            ...imageFiles.map(file => file.download({ destination: path.join(tempDir, path.basename(file.name)) })),
            inputBucket.file(`${projectId}/narration.mp3`).download({ destination: path.join(tempDir, 'narration.mp3') }),
            inputBucket.file(`${projectId}/captions.srt`).download({ destination: path.join(tempDir, 'captions.srt') }),
        ]);
        console.log('Asset download complete.');

        // 3. FFmpeg processing
        console.log('Starting FFmpeg processing...');
        const command = ffmpeg();
        const complexFilter = [];
        let sceneOutputs = [];

        // For each scene, create a short video clip from its image sequence
        scenes.forEach((scene, sceneIndex) => {
            const imagePattern = path.join(tempDir, `scene-${sceneIndex}-%d.jpeg`);
            const sceneOutput = `scene_clip_${sceneIndex}`;
            const duration = scene.duration || 3;
            
            command.input(imagePattern)
                .inputOptions(['-framerate 1.5']) // Each image shows for ~0.66 seconds
                .loop(duration) // Dynamic duration based on user setting
                .videoCodec('libx264');

            // Dynamic camera movement based on user selection
            let zoomEffect;
            switch (scene.camera || 'static') {
                case 'zoom-in':
                    zoomEffect = "zoompan=z='min(zoom+0.001,1.3)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1280x720";
                    break;
                case 'zoom-out':
                    zoomEffect = "zoompan=z='if(lte(zoom,1.0),1.3,max(1.001,zoom-0.001))':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1280x720";
                    break;
                case 'pan-left':
                    zoomEffect = "zoompan=z='1.1':d=1:x='iw/2-(iw/zoom/2)-50*sin(t)':y='ih/2-(ih/zoom/2)':s=1280x720";
                    break;
                case 'pan-right':
                    zoomEffect = "zoompan=z='1.1':d=1:x='iw/2-(iw/zoom/2)+50*sin(t)':y='ih/2-(ih/zoom/2)':s=1280x720";
                    break;
                default: // static
                    zoomEffect = "scale=1280:720";
                    break;
            }
            
            complexFilter.push(`[${sceneIndex}:v]${zoomEffect},format=yuv420p[v${sceneIndex}]`);
            sceneOutputs.push(`[v${sceneIndex}]`);
        });

        // Chain all scene clips together with dynamic transitions
        let currentStream = sceneOutputs[0];
        let totalDuration = 0;
        
        for (let i = 1; i < sceneOutputs.length; i++) {
            const nextStream = sceneOutputs[i];
            const transitionOutput = `transition_${i}`;
            const currentScene = scenes[i - 1];
            const nextScene = scenes[i];
            const transition = nextScene.transition || 'fade';
            const transitionDuration = 0.75;
            
            // Calculate offset based on actual scene durations
            totalDuration += currentScene.duration || 3;
            const offset = totalDuration - transitionDuration;
            
            if (transition === 'none') {
                // No transition, just concatenate
                complexFilter.push(`${currentStream}${nextStream}concat=n=2:v=1:a=0[${transitionOutput}]`);
            } else {
                // Apply the selected transition
                complexFilter.push(`${currentStream}${nextStream}xfade=transition=${transition}:duration=${transitionDuration}:offset=${offset}[${transitionOutput}]`);
            }
            currentStream = `[${transitionOutput}]`;
        }

        // Add subtitles and define final output
        const finalVideoOutput = '[final_video]';
        complexFilter.push(`${currentStream}subtitles=${path.join(tempDir, 'captions.srt')}:force_style='Fontsize=18,PrimaryColour=&HFFFFFF&,OutlineColour=&H000000&,BorderStyle=3,Outline=1,Shadow=1,MarginV=25'${finalVideoOutput}`);
        
        const outputVideoPath = path.join(tempDir, 'final_movie.mp4');

        await new Promise((resolve, reject) => {
            command
                .input(path.join(tempDir, 'narration.mp3')) // Add audio track
                .complexFilter(complexFilter)
                .map(finalVideoOutput) // Map the final video stream
                .map('a') // Map the audio stream from the last input (narration.mp3)
                .outputOptions([
                    '-c:v libx264',
                    '-preset slow',
                    '-crf 22',
                    '-c:a aac',
                    '-b:a 192k',
                    '-pix_fmt yuv420p',
                    '-shortest' // Finish encoding when the shortest input (audio) ends
                ])
                .on('end', () => {
                    console.log('FFmpeg processing finished.');
                    resolve();
                })
                .on('error', (err) => {
                    console.error('FFmpeg error:', err.message);
                    reject(new Error('FFmpeg failed to render the video.'));
                })
                .save(outputVideoPath);
        });

        // 4. Upload the final video to the output bucket
        console.log('Uploading final video...');
        const outputBucket = storage.bucket(outputBucketName);
        const [uploadedFile] = await outputBucket.upload(outputVideoPath, {
            destination: `${projectId}/movie.mp4`,
            metadata: { contentType: 'video/mp4' },
        });
        await uploadedFile.makePublic(); // Make the final video publicly accessible
        
        console.log(`Video uploaded successfully to ${uploadedFile.publicUrl()}`);
        res.status(200).json({ videoUrl: uploadedFile.publicUrl() });

    } catch (error) {
        console.error(`Error rendering video for projectId ${projectId}:`, error);
        res.status(500).json({ error: 'Failed to render video.', details: error.message });
    } finally {
        // 5. Cleanup: Remove the temporary local directory
        await fs.rm(tempDir, { recursive: true, force: true });
        console.log(`Cleaned up temporary directory: ${tempDir}`);
    }
});


const PORT = process.env.PORT || 8082;
app.listen(PORT, () => {
  console.log(`Render service listening on port ${PORT}`);
});
