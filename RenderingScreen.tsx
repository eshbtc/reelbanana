
import React, { useState, useEffect } from 'react';
import { Scene } from './types';
import AnimatedLoader from './components/AnimatedLoader';

interface RenderingScreenProps {
  scenes: Scene[];
  onRenderComplete: (videoUrl: string) => void;
  onRenderFail: (errorMessage: string) => void;
}

// --- IMPORTANT ---
// Replace these placeholder URLs with the actual Service URLs you received
// after deploying your backend microservices in Phase 3.
const NARRATE_SERVICE_URL = "https://your-narrate-service-url.a.run.app/narrate";
const ALIGN_CAPTIONS_SERVICE_URL = "https://your-align-captions-service-url.a.run.app/align";
const RENDER_SERVICE_URL = "https://your-render-service-url.a.run.app/render";
// ---

const RenderingScreen: React.FC<RenderingScreenProps> = ({ scenes, onRenderComplete, onRenderFail }) => {
  const [progressMessage, setProgressMessage] = useState("Initializing render process...");
  const [projectId] = useState(`project_${Date.now()}`); // Generate a unique ID for this movie

  useEffect(() => {
    const runFullRenderPipeline = async () => {
      try {
        if (scenes.length === 0) {
            throw new Error("No scenes were provided to render.");
        }

        // In a real production app, step 0 would be to upload the generated images
        // from the browser to GCS. Since we are generating them with a backend-facing key,
        // we'll assume they are accessible for this demo.
        setProgressMessage("Uploading scene assets...");
        await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate upload time

        // Step 1: Generate Narration
        setProgressMessage("Generating character narration...");
        const narrationText = scenes.map(s => s.narration).join(' ');
        
        const narrateResponse = await fetch(NARRATE_SERVICE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId, narrationText }),
        });
        if (!narrateResponse.ok) throw new Error(`Narration service failed: ${await narrateResponse.text()}`);
        const { audioPath } = await narrateResponse.json();
        console.log('Narration complete:', audioPath);

        // Step 2: Align Captions
        setProgressMessage("Aligning captions with audio...");
        const alignResponse = await fetch(ALIGN_CAPTIONS_SERVICE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId, gsAudioPath: audioPath }),
        });
        if (!alignResponse.ok) throw new Error(`Caption alignment failed: ${await alignResponse.text()}`);
        const { srtPath } = await alignResponse.json();
        console.log('Caption alignment complete:', srtPath);

        // Step 3: Render the Final Video
        setProgressMessage("Assembling scenes and rendering video...");
        const renderResponse = await fetch(RENDER_SERVICE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId }),
        });
        if (!renderResponse.ok) throw new Error(`Video rendering failed: ${await renderResponse.text()}`);
        const { videoPath } = await renderResponse.json();
        console.log('Rendering complete:', videoPath);

        // Convert GCS path to public URL
        const publicUrl = videoPath.replace('gs://', 'https://storage.googleapis.com/');
        onRenderComplete(publicUrl);

      } catch (error) {
        console.error("Render pipeline failed:", error);
        onRenderFail(error instanceof Error ? error.message : "An unknown error occurred.");
      }
    };

    runFullRenderPipeline();
  }, [scenes, projectId, onRenderComplete, onRenderFail]);

  return (
    <div className="text-center p-8">
      <h2 className="text-4xl font-bold mb-4 text-amber-400">Creating Your Movie...</h2>
      <p className="text-xl text-gray-300 mb-8 h-8">{progressMessage}</p>
      <div className="flex justify-center my-4">
        <AnimatedLoader />
      </div>
    </div>
  );
};

export default RenderingScreen;
