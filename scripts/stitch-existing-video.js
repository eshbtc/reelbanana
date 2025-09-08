#!/usr/bin/env node

/**
 * Emergency script to stitch existing video clips into final video
 * Uses existing clips from GCS to avoid regenerating and save costs
 */

import { Storage } from '@google-cloud/storage';
import fs from 'fs/promises';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';

const PROJECT_ID = 'MFFE4hv1oI8QBeyoTBtk';
const INPUT_BUCKET = 'reel-banana-35a54.firebasestorage.app';
const OUTPUT_BUCKET = 'reel-banana-videos-public';

async function stitchExistingVideo() {
  console.log(`🎬 Stitching existing video for project: ${PROJECT_ID}`);
  
  const storage = new Storage();
  const inputBucket = storage.bucket(INPUT_BUCKET);
  const outputBucket = storage.bucket(OUTPUT_BUCKET);
  
  // Create temp directory
  const tempDir = path.join('/tmp', PROJECT_ID);
  await fs.mkdir(tempDir, { recursive: true });
  
  try {
    // 1. Download all existing clips
    console.log('📥 Downloading existing clips...');
    const clipPaths = [];
    const clipCount = 17; // Based on the bucket listing
    
    for (let i = 0; i < clipCount; i++) {
      const clipFile = inputBucket.file(`${PROJECT_ID}/clips/scene-${i}.mp4`);
      const [exists] = await clipFile.exists();
      
      if (exists) {
        const localPath = path.join(tempDir, `clip-${i}.mp4`);
        await clipFile.download({ destination: localPath });
        clipPaths.push(localPath);
        console.log(`✅ Downloaded clip ${i}`);
      } else {
        console.log(`⚠️  Clip ${i} not found, skipping`);
      }
    }
    
    if (clipPaths.length === 0) {
      throw new Error('No clips found to stitch');
    }
    
    console.log(`📊 Found ${clipPaths.length} clips to stitch`);
    
    // 2. Download audio files
    console.log('🎵 Downloading audio files...');
    const audioPath = path.join(tempDir, 'narration.mp3');
    const musicPath = path.join(tempDir, 'music.wav');
    
    // Download narration
    const narrationFile = inputBucket.file(`${PROJECT_ID}/narration.mp3`);
    const [narrationExists] = await narrationFile.exists();
    if (narrationExists) {
      await narrationFile.download({ destination: audioPath });
      console.log('✅ Downloaded narration');
    }
    
    // Download music
    const musicFile = inputBucket.file(`${PROJECT_ID}/music.wav`);
    const [musicExists] = await musicFile.exists();
    if (musicExists) {
      await musicFile.download({ destination: musicPath });
      console.log('✅ Downloaded music');
    }
    
    // 3. Create concat list
    console.log('📝 Creating concat list...');
    const concatListPath = path.join(tempDir, 'concat_list.txt');
    const concatList = clipPaths.map(clipPath => `file '${clipPath}'`).join('\n');
    await fs.writeFile(concatListPath, concatList);
    
    // 4. Concatenate video clips
    console.log('🎞️  Concatenating video clips...');
    const silentVideoPath = path.join(tempDir, 'silent_video.mp4');
    
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(concatListPath)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .outputOptions(['-c', 'copy'])
        .on('end', () => {
          console.log('✅ Video concatenation complete');
          resolve();
        })
        .on('error', (err) => {
          console.error('❌ FFmpeg concat error:', err.message);
          reject(err);
        })
        .save(silentVideoPath);
    });
    
    // 5. Add audio
    console.log('🔊 Adding audio...');
    const finalVideoPath = path.join(tempDir, 'final_video.mp4');
    const audioInputs = [silentVideoPath];
    const audioFilters = [];
    
    // Calculate total video duration (8 seconds per clip)
    const totalVideoDuration = clipPaths.length * 8;
    console.log(`⏱️  Total video duration: ${totalVideoDuration} seconds`);
    
    if (await fs.access(audioPath).then(() => true).catch(() => false)) {
      audioInputs.push(audioPath);
      audioFilters.push(`[1:a]atrim=0:${totalVideoDuration},afade=t=out:st=${Math.max(0, totalVideoDuration-1)}:d=1,volume=1.0[audio1]`);
    }
    
    if (await fs.access(musicPath).then(() => true).catch(() => false)) {
      audioInputs.push(musicPath);
      audioFilters.push(`[2:a]atrim=0:${totalVideoDuration},afade=t=out:st=${Math.max(0, totalVideoDuration-1)}:d=1,volume=0.3[audio2]`);
    }
    
    if (audioFilters.length > 0) {
      // Mix audio tracks
      const mixFilter = audioFilters.length === 2 
        ? '[audio1][audio2]amix=inputs=2:duration=longest[audio]'
        : '[audio1]acopy[audio]';
      audioFilters.push(mixFilter);
      
      await new Promise((resolve, reject) => {
        const command = ffmpeg();
        audioInputs.forEach(input => command.input(input));
        command
          .complexFilter(audioFilters)
          .outputOptions(['-map', '0:v', '-map', '[audio]', '-c:v', 'copy', '-c:a', 'aac', '-shortest'])
          .on('end', () => {
            console.log('✅ Audio mixing complete');
            resolve();
          })
          .on('error', (err) => {
            console.error('❌ FFmpeg audio mix error:', err.message);
            reject(err);
          })
          .save(finalVideoPath);
      });
    } else {
      // No audio, just copy the video
      await fs.copyFile(silentVideoPath, finalVideoPath);
    }
    
    // 6. Upload to public bucket
    console.log('☁️  Uploading to public bucket...');
    const finalVideoFile = outputBucket.file(`${PROJECT_ID}/movie.mp4`);
    const videoBuffer = await fs.readFile(finalVideoPath);
    await finalVideoFile.save(videoBuffer, { 
      metadata: { contentType: 'video/mp4' }
    });
    
    // Make public
    await finalVideoFile.makePublic();
    const publicUrl = finalVideoFile.publicUrl();
    
    console.log('🎉 SUCCESS!');
    console.log(`📺 Video URL: ${publicUrl}`);
    console.log(`📊 Clips used: ${clipPaths.length}`);
    console.log(`⏱️  Duration: ~${totalVideoDuration} seconds`);
    
    return publicUrl;
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    // Cleanup
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
      console.log('🧹 Cleaned up temp files');
    } catch (e) {
      console.warn('⚠️  Cleanup warning:', e.message);
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  stitchExistingVideo()
    .then(url => {
      console.log('\n🎬 Final video ready for hackathon submission!');
      console.log(`🔗 ${url}`);
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Failed to create video:', error.message);
      process.exit(1);
    });
}

export { stitchExistingVideo };
