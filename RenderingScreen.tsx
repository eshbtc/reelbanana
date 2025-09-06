// Fix: Implement the RenderingScreen component to handle the movie creation pipeline.
import React, { useState, useEffect, useMemo } from 'react';
import { Scene } from './types';
import AnimatedLoader from './components/AnimatedLoader';

// Define service URLs - assuming they are proxied or run on these ports locally
const UPLOAD_SERVICE_URL = process.env.REACT_APP_UPLOAD_SERVICE_URL || 'http://localhost:8083/upload';
const NARRATE_SERVICE_URL = process.env.REACT_APP_NARRATE_SERVICE_URL || 'http://localhost:8080/narrate';
const ALIGN_SERVICE_URL = process.env.REACT_APP_ALIGN_SERVICE_URL || 'http://localhost:8081/align';
const RENDER_SERVICE_URL = process.env.REACT_APP_RENDER_SERVICE_URL || 'http://localhost:8082/render';
const OUTPUT_BUCKET_PUBLIC_URL = `https://storage.googleapis.com/oneminute-movie-out`;


interface RenderingScreenProps {
  scenes: Scene[];
  onRenderComplete: (videoUrl: string) => void;
  onRenderFail: (errorMessage: string) => void;
}

const RenderingScreen: React.FC<RenderingScreenProps> = ({ scenes, onRenderComplete, onRenderFail }) => {
  const [status, setStatus] = useState('Starting movie creation...');
  const [progress, setProgress] = useState(0);

  const messages = useMemo(() => [
    "Compositing pixels into a masterpiece...",
    "Teaching the digital actors their lines...",
    "Brewing coffee for the rendering farm...",
    "Polishing the final cut...",
    "Untangling the film reels...",
    "Adjusting the director's chair...",
    "Rolling the virtual cameras..."
  ], []);

  const [dynamicMessage, setDynamicMessage] = useState(messages[0]);

  useEffect(() => {
    const messageInterval = setInterval(() => {
        setDynamicMessage(messages[Math.floor(Math.random() * messages.length)]);
    }, 4000);
    return () => clearInterval(messageInterval);
  }, [messages]);


  useEffect(() => {
    const createMovie = async () => {
      if (!scenes || scenes.length === 0) {
        onRenderFail("No scenes provided to render.");
        return;
      }

      const projectId = `proj-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      console.log(`Starting movie creation for projectId: ${projectId}`);

      try {
        // Step 1: Upload all image assets
        setStatus('Uploading scene images...');
        setProgress(10);
        const imageAssets = scenes.flatMap((scene, sceneIndex) => 
            scene.imageUrls?.map((base64Url, imageIndex) => ({
                sceneIndex,
                imageIndex,
                base64Data: base64Url.split(',')[1], // Remove "data:image/jpeg;base64,"
            })) ?? []
        );

        if (imageAssets.length === 0) {
            throw new Error("No images found in the scenes to render.");
        }

        const uploadResponse = await fetch(UPLOAD_SERVICE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId, images: imageAssets }),
        });
        if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json();
            throw new Error(`Failed to upload assets: ${errorData.details || uploadResponse.statusText}`);
        }
        console.log(`[${projectId}] Asset upload complete.`);
        setProgress(30);

        // Step 2: Generate narration for the entire story
        setStatus('Generating voiceover...');
        const fullNarration = scenes.map(s => s.narration).join(' ');
        const narrateResponse = await fetch(NARRATE_SERVICE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId, narrationText: fullNarration }),
        });
        if (!narrateResponse.ok) {
            const errorData = await narrateResponse.json();
            throw new Error(`Failed to generate narration: ${errorData.details || narrateResponse.statusText}`);
        }
        const { audioPath } = await narrateResponse.json();
        console.log(`[${projectId}] Narration generated at: ${audioPath}`);
        setProgress(50);
        
        // Step 3: Align captions
        setStatus('Aligning captions...');
        const alignResponse = await fetch(ALIGN_SERVICE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId, gsAudioPath: audioPath }),
        });
        if (!alignResponse.ok) {
            const errorData = await alignResponse.json();
            throw new Error(`Failed to align captions: ${errorData.details || alignResponse.statusText}`);
        }
        console.log(`[${projectId}] Captions aligned.`);
        setProgress(70);

        // Step 4: Render the final video
        setStatus('Assembling the final movie... this may take a few minutes.');
        const renderResponse = await fetch(RENDER_SERVICE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId }),
        });
        if (!renderResponse.ok) {
            const errorData = await renderResponse.json();
            throw new Error(`Failed to render video: ${errorData.details || renderResponse.statusText}`);
        }
        const { videoPath } = await renderResponse.json();
        console.log(`[${projectId}] Video rendered at: ${videoPath}`);
        setProgress(100);
        setStatus('Your movie is ready!');

        const publicUrl = `${OUTPUT_BUCKET_PUBLIC_URL}/${projectId}/movie.mp4`;

        setTimeout(() => {
            onRenderComplete(publicUrl);
        }, 1500);

      } catch (error) {
        console.error("Movie creation failed:", error);
        onRenderFail(error instanceof Error ? error.message : "An unknown error occurred during movie creation.");
      }
    };

    createMovie();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenes, onRenderComplete, onRenderFail]);

  return (
    <div className="flex flex-col items-center justify-center text-center h-full min-h-[60vh]">
        <h1 className="text-4xl font-bold text-amber-400 mb-4">Creating Your Movie</h1>
        <p className="text-lg text-gray-300 mb-8">{status}</p>
        
        <AnimatedLoader />

        <div className="w-full max-w-lg bg-gray-700 rounded-full h-4 mt-8 overflow-hidden">
            <div 
                className="bg-green-500 h-4 rounded-full transition-all duration-500" 
                style={{ width: `${progress}%` }}
            ></div>
        </div>
        
        <p className="text-md text-gray-400 mt-4 animate-pulse">{dynamicMessage}</p>
    </div>
  );
};

export default RenderingScreen;
