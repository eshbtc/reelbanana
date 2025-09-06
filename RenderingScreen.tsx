import React, { useState, useEffect } from 'react';
import { Scene } from './types';
import AnimatedLoader from './components/AnimatedLoader';

interface RenderingScreenProps {
  scenes: Scene[];
  onRenderComplete: (url: string) => void;
  onRenderFail: (errorMessage: string) => void;
}

// These should probably be in a config file or environment variables, but are hardcoded for simplicity.
const UPLOAD_SERVICE_URL = process.env.REACT_APP_UPLOAD_SERVICE_URL || 'http://localhost:8083';
const NARRATE_SERVICE_URL = process.env.REACT_APP_NARRATE_SERVICE_URL || 'http://localhost:8080';
const ALIGN_SERVICE_URL = process.env.REACT_APP_ALIGN_SERVICE_URL || 'http://localhost:8081';
const RENDER_SERVICE_URL = process.env.REACT_APP_RENDER_SERVICE_URL || 'http://localhost:8082';

// Public URL for the output bucket
const OUTPUT_BUCKET_PUBLIC_URL = `https://storage.googleapis.com/oneminute-movie-out`;

const loadingMessages = [
    "Warming up the cameras...",
    "Polishing the director's lens...",
    "Teaching the AI to whisper sweet nothings...",
    "Aligning the words with the stars...",
    "Assembling the scenes frame by frame...",
    "Adding a pinch of digital stardust...",
    "Rendering the final cut...",
    "This is taking longer than usual, the AI is being an artist...",
    "Almost there, just signing the autographs..."
];

const RenderingScreen: React.FC<RenderingScreenProps> = ({ scenes, onRenderComplete, onRenderFail }) => {
  const [statusMessage, setStatusMessage] = useState('Preparing your masterpiece...');
  const [currentLoadingMessage, setCurrentLoadingMessage] = useState(loadingMessages[0]);
  
  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentLoadingMessage(prev => {
        const currentIndex = loadingMessages.indexOf(prev);
        const nextIndex = (currentIndex + 1) % loadingMessages.length;
        return loadingMessages[nextIndex];
      });
    }, 4000); // Change message every 4 seconds

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const createMovie = async () => {
      try {
        // 0. Generate a unique ID for this movie project
        const projectId = `movie-${Date.now()}`;
        console.log(`Starting movie creation with projectId: ${projectId}`);
        
        // 1. Upload all image assets for the scenes
        setStatusMessage('Uploading scene images...');
        const scenesToUpload = scenes.map((scene, index) => ({
            sceneIndex: index,
            images: scene.imageUrls || [],
        }));

        const uploadResponse = await fetch(`${UPLOAD_SERVICE_URL}/upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, scenes: scenesToUpload }),
        });

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json();
          throw new Error(`Failed to upload assets: ${errorData.details || uploadResponse.statusText}`);
        }
        console.log(`[${projectId}] Assets uploaded successfully.`);

        // 2. Generate narration for the entire story
        setStatusMessage('Generating voiceover...');
        const fullNarration = scenes.map(s => s.narration).join(' ');
        const narrateResponse = await fetch(`${NARRATE_SERVICE_URL}/narrate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId, narrationText: fullNarration }),
        });

        if (!narrateResponse.ok) {
            const errorData = await narrateResponse.json();
            throw new Error(`Failed to generate narration: ${errorData.details || narrateResponse.statusText}`);
        }
        const { audioPath } = await narrateResponse.json();
        console.log(`[${projectId}] Narration created: ${audioPath}`);


        // 3. Align captions
        setStatusMessage('Creating subtitles...');
        const alignResponse = await fetch(`${ALIGN_SERVICE_URL}/align`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId, gsAudioPath: audioPath }),
        });

         if (!alignResponse.ok) {
            const errorData = await alignResponse.json();
            throw new Error(`Failed to align captions: ${errorData.details || alignResponse.statusText}`);
        }
        const { srtPath } = await alignResponse.json();
        console.log(`[${projectId}] Captions aligned: ${srtPath}`);

        // 4. Trigger the final render
        setStatusMessage('Rendering final video...');
        const renderResponse = await fetch(`${RENDER_SERVICE_URL}/render`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId }),
        });
        
        if (!renderResponse.ok) {
            const errorData = await renderResponse.json();
            throw new Error(`Failed to render video: ${errorData.details || renderResponse.statusText}`);
        }
        const { videoPath } = await renderResponse.json(); // This is gs://...
        console.log(`[${projectId}] Video rendered: ${videoPath}`);
        
        // 5. Construct public URL and complete
        const publicUrl = `${OUTPUT_BUCKET_PUBLIC_URL}/${projectId}/movie.mp4`;
        onRenderComplete(publicUrl);

      } catch (error) {
        console.error("Movie creation failed:", error);
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        onRenderFail(message);
      }
    };

    createMovie();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenes]);

  return (
    <div className="flex flex-col items-center justify-center text-center h-96">
      <AnimatedLoader />
      <h2 className="text-3xl font-bold mt-8 text-amber-400">{statusMessage}</h2>
      <p className="text-gray-400 mt-4 max-w-md">{currentLoadingMessage}</p>
    </div>
  );
};

export default RenderingScreen;
