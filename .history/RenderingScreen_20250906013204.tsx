import React, { useState, useEffect } from 'react';
import { Scene } from './types';
import AnimatedLoader from './components/AnimatedLoader';

// Define the structure of the props
interface RenderingScreenProps {
  scenes: Scene[];
  onRenderComplete: (url: string) => void;
  onRenderFail: (errorMessage: string) => void;
}

// Define the different stages of the rendering process
type RenderStage = 
  | 'idle'
  | 'initializing'
  | 'uploading'
  | 'narrating'
  | 'aligning'
  | 'composing'
  | 'rendering'
  | 'done';

const STAGE_MESSAGES: Record<RenderStage, string> = {
  idle: 'Preparing to start...',
  initializing: 'Initializing movie project...',
  uploading: 'Uploading image assets...',
  narrating: 'Generating voiceover narration...',
  aligning: 'Generating synchronized captions...',
  composing: 'Creating musical score...',
  rendering: 'Assembling the final movie...',
  done: 'Your movie is ready!',
};

import { API_ENDPOINTS, apiCall } from './config/apiConfig';

const RenderingScreen: React.FC<RenderingScreenProps> = ({ scenes, onRenderComplete, onRenderFail }) => {
  const [stage, setStage] = useState<RenderStage>('idle');
  const [progress, setProgress] = useState(0); // For uploads, 0 to 100

  useEffect(() => {
    const startRenderingProcess = async () => {
      // 1. Initialize project
      setStage('initializing');
      const projectId = `movie-${Date.now()}`;
      
      try {
        // 2. Upload all images
        setStage('uploading');
        const allImageUrls = scenes.flatMap((scene, sceneIndex) =>
          (scene.imageUrls || []).map((url, imageIndex) => ({
            base64Image: url,
            fileName: `scene-${sceneIndex}-${imageIndex}.jpeg`,
          }))
        );

        let uploadedCount = 0;
        await Promise.all(
          allImageUrls.map(async (image) => {
            await apiCall(SERVICE_ENDPOINTS.upload, 
              { projectId, ...image }, 
              'Failed to upload image'
            );
            uploadedCount++;
            setProgress(Math.round((uploadedCount / allImageUrls.length) * 100));
          })
        );
        
        // 3. Generate narration
        setStage('narrating');
        const narrationScript = scenes.map(s => s.narration).join(' ');
        const { gsAudioPath } = await apiCall(SERVICE_ENDPOINTS.narrate, 
          { projectId, narrationScript }, 
          'Failed to generate narration'
        );

        // 4. Align captions
        setStage('aligning');
        const { srtPath } = await apiCall(SERVICE_ENDPOINTS.align, 
          { projectId, gsAudioPath }, 
          'Failed to align captions'
        );

        // 5. Compose musical score
        setStage('composing');
        const { gsMusicPath } = await apiCall(API_ENDPOINTS.compose, 
          { projectId, narrationScript }, 
          'Failed to compose music'
        );

        // 6. Render video
        setStage('rendering');
        const sceneDataForRender = scenes.map(scene => ({
            narration: scene.narration,
            imageCount: scene.imageUrls?.length || 0,
            camera: scene.camera || 'static',
            transition: scene.transition || 'fade',
            duration: scene.duration || 3,
        }));
        // Assuming render service knows how to find assets by projectId and scene structure.
<<<<<<< HEAD
        const { videoUrl } = await apiCall(API_ENDPOINTS.render, 
          { projectId, scenes: sceneDataForRender, gsAudioPath, srtPath, gsMusicPath }, 
=======
        const { videoUrl } = await apiCall(SERVICE_ENDPOINTS.render, 
          { projectId, scenes: sceneDataForRender, gsAudioPath, srtPath }, 
>>>>>>> 525e7be8ee157e7a550ccb5e75f8fabb4e2b59bb
          'Failed to render video'
        );

        // 7. Complete
        setStage('done');
        onRenderComplete(videoUrl);

      } catch (error) {
        if (error instanceof Error) {
          onRenderFail(error.message);
        } else {
          onRenderFail('An unknown error occurred during rendering.');
        }
      }
    };

    if (scenes.length > 0) {
      startRenderingProcess();
    }
  }, [scenes, onRenderComplete, onRenderFail]);

  const renderProgressIndicator = () => {
      const stages: RenderStage[] = ['uploading', 'narrating', 'aligning', 'composing', 'rendering'];
      const currentStageIndex = stages.indexOf(stage);

      return (
          <div className="w-full max-w-2xl mx-auto mt-8">
              <div className="flex justify-between mb-2">
                  {stages.map((s, index) => (
                      <div key={s} className={`text-xs text-center flex-1 ${index <= currentStageIndex ? 'text-amber-400 font-bold' : 'text-gray-500'}`}>
                          {STAGE_MESSAGES[s].replace('...','')}
                      </div>
                  ))}
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2.5">
                  <div 
                    className="bg-amber-500 h-2.5 rounded-full transition-all duration-500" 
                    style={{ width: `${(currentStageIndex / (stages.length - 1)) * 100}%` }}>
                  </div>
              </div>
          </div>
      );
  }

  return (
    <div className="flex flex-col items-center justify-center text-center h-[60vh]">
      <AnimatedLoader />
      <h1 className="text-3xl font-bold mt-8 text-white tracking-wide">{STAGE_MESSAGES[stage]}</h1>
      {stage === 'uploading' && <p className="text-gray-400 mt-2">{progress}% complete</p>}
      {renderProgressIndicator()}
      <p className="text-gray-500 mt-12 max-w-lg">
        This can take a few minutes, especially for longer videos. Please don't close this window. We're busy directing, editing, and adding special effects to your masterpiece!
      </p>
    </div>
  );
};

export default RenderingScreen;