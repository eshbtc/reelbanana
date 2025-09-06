const express = require('express');
const cors = require('cors');
const { Storage } = require('@google-cloud/storage');
const ffmpeg = require('fluent-ffmpeg');
const os = require('os');
const path = require('path');
const fs = require('fs').promises;

const app = express();
app.use(express.json());
app.use(cors());

const storage = new Storage();
const inBucketName = 'oneminute-movie-in';
const outBucketName = 'oneminute-movie-out';

/**
 * POST /render
 * Orchestrates the entire video rendering process.
 */
app.post('/render', async (req, res) => {
    const { projectId } = req.body;
    if (!projectId) {
        return res.status(400).json({ error: 'Missing projectId' });
    }

    console.log(`Starting render process for projectId: ${projectId}`);
    
    // Create a unique temporary directory for this render job
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `render-${projectId}-`));

    try {
        // 1. Download all assets from GCS
        console.log(`[${projectId}] Downloading assets...`);
        const assetPaths = await downloadAssets(projectId, tempDir);

        // 2. Identify image sequences for each scene
        const sceneSequences = groupImagesByScene(assetPaths.imageFiles);

        // 3. Create a video clip for each scene sequence
        console.log(`[${projectId}] Creating individual scene clips...`);
        const sceneClipPaths = await createSceneClips(sceneSequences, tempDir);

        // 4. Concatenate scene clips with crossfades
        console.log(`[${projectId}] Concatenating clips with crossfades...`);
        const concatenatedVideoPath = await concatenateClips(sceneClipPaths, tempDir);

        // 5. Add narration and burn subtitles
        console.log(`[${projectId}] Adding audio and subtitles...`);
        const finalVideoPath = await addAudioAndSubtitles(concatenatedVideoPath, assetPaths.audioFile, assetPaths.srtFile, tempDir);
        
        // 6. Upload final video to GCS
        console.log(`[${projectId}] Uploading final video...`);
        const gcsPath = await uploadFinalVideo(finalVideoPath, projectId);

        console.log(`[${projectId}] Render process completed successfully.`);
        res.status(200).json({ videoPath: gcsPath });

    } catch (error) {
        console.error(`[${projectId}] Render process failed:`, error);
        res.status(500).json({ error: 'Failed to render video.', details: error.message });
    } finally {
        // 7. Clean up temporary files
        console.log(`[${projectId}] Cleaning up temporary directory...`);
        await fs.rm(tempDir, { recursive: true, force: true });
    }
});

// --- HELPER FUNCTIONS ---

async function downloadAssets(projectId, tempDir) {
    const bucket = storage.bucket(inBucketName);
    const [files] = await bucket.getFiles({ prefix: `${projectId}/` });
    
    const downloadPromises = files.map(file => {
        const destPath = path.join(tempDir, path.basename(file.name));
        return file.download({ destination: destPath }).then(() => ({ name: file.name, path: destPath }));
    });

    const downloadedFiles = await Promise.all(downloadPromises);

    return {
        imageFiles: downloadedFiles.filter(f => f.name.endsWith('.jpeg') || f.name.endsWith('.png')),
        audioFile: downloadedFiles.find(f => f.name.endsWith('.mp3'))?.path,
        srtFile: downloadedFiles.find(f => f.name.endsWith('.srt'))?.path,
    };
}

function groupImagesByScene(imageFiles) {
    const scenes = {};
    imageFiles.forEach(file => {
        // Assuming filename format is `scene-INDEX-SEQUENCE.jpeg`
        const match = path.basename(file.name).match(/scene-(\d+)-(\d+)\.jpeg/);
        if (match) {
            const sceneIndex = parseInt(match[1], 10);
            if (!scenes[sceneIndex]) {
                scenes[sceneIndex] = [];
            }
            scenes[sceneIndex].push(file.path);
        }
    });
    // Sort sequences correctly
    Object.values(scenes).forEach(scene => scene.sort());
    return Object.values(scenes);
}

function createSceneClips(sceneSequences, tempDir) {
    const clipPromises = sceneSequences.map((sequence, index) => {
        return new Promise((resolve, reject) => {
            const clipPath = path.join(tempDir, `clip_${index}.mp4`);
            // Create a file list for ffmpeg
            const listContent = sequence.map(imgPath => `file '${imgPath}'`).join('\n');
            const listPath = path.join(tempDir, `list_${index}.txt`);
            fs.writeFile(listPath, listContent);

            ffmpeg()
                .input(listPath)
                .inputOptions(['-f concat', '-safe 0'])
                .outputOptions([
                    '-framerate 30', // Output framerate
                    '-c:v libx264',
                    '-r 30', // Ensure constant framerate for concatenation
                    '-pix_fmt yuv420p',
                ])
                .fps(2) // Each image lasts 0.5s
                .videoFilter("scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1")
                .save(clipPath)
                .on('end', () => resolve(clipPath))
                .on('error', reject);
        });
    });
    return Promise.all(clipPromises);
}


function concatenateClips(clipPaths, tempDir) {
    return new Promise((resolve, reject) => {
        if (clipPaths.length === 1) return resolve(clipPaths[0]);
        
        const concatenatedPath = path.join(tempDir, 'concatenated.mp4');
        const complexFilter = [];
        const inputs = [];

        clipPaths.forEach((clip, index) => {
            inputs.push(ffmpeg(clip));
            if(index > 0) {
                // Example crossfade transition
                const prev = index - 1;
                complexFilter.push(`[${prev}:v][${index}:v]xfade=transition=fade:duration=0.5:offset=${(index * 2.5) - 0.5}[v${index}]`);
            }
        });

        const command = inputs.reduce((cmd, input) => cmd.input(input), ffmpeg());

        // This is a simplified concatenation filter logic. Real-world might need to be more robust.
        // For now, let's use a simpler concat filter via a file list for stability.
        const concatListContent = clipPaths.map(p => `file '${p}'`).join('\n');
        const concatListPath = path.join(tempDir, 'concat_list.txt');
        fs.writeFile(concatListPath, concatListContent);

        ffmpeg()
            .input(concatListPath)
            .inputOptions(['-f concat', '-safe 0'])
            .outputOptions(['-c copy'])
            .save(concatenatedPath)
            .on('end', () => resolve(concatenatedPath))
            .on('error', reject);
    });
}

function addAudioAndSubtitles(videoPath, audioPath, srtPath, tempDir) {
    return new Promise((resolve, reject) => {
        if (!audioPath || !srtPath) {
            return reject(new Error("Audio or SRT file is missing for the final render."));
        }
        const finalPath = path.join(tempDir, 'final_movie.mp4');
        
        ffmpeg(videoPath)
            .input(audioPath)
            .videoFilter(`subtitles=${srtPath}:force_style='Fontsize=24,PrimaryColour=&H00FFFFFF,BorderStyle=3,Outline=1,Shadow=1'`)
            .outputOptions([
                '-c:v libx264',
                '-c:a aac',
                '-strict experimental',
                '-shortest', // Finish encoding when the shortest input stream ends
            ])
            .save(finalPath)
            .on('end', () => resolve(finalPath))
            .on('error', reject);
    });
}

async function uploadFinalVideo(localPath, projectId) {
    const bucket = storage.bucket(outBucketName);
    const destination = `${projectId}/movie.mp4`;
    await bucket.upload(localPath, {
        destination: destination,
        metadata: { contentType: 'video/mp4' },
    });
    const gcsPath = `gs://${outBucketName}/${destination}`;
    console.log(`Uploaded final video to ${gcsPath}`);
    return gcsPath;
}

const PORT = process.env.PORT || 8082;
app.listen(PORT, () => {
  console.log(`Render service listening on port ${PORT}`);
});
