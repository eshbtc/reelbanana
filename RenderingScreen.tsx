import React, { useState, useEffect } from 'react';
import { Scene } from './types';
import AnimatedLoader from './components/AnimatedLoader';
import { getCurrentUser } from './services/authService';

// Define the structure of the props
interface RenderingScreenProps {
  scenes: Scene[];
  emotion?: string;
  proPolish?: boolean;
  projectId?: string;
  demoMode?: boolean;
  onRenderComplete: (url: string, projectId?: string) => void;
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
  | 'polishing'
  | 'done';

const STAGE_MESSAGES: Record<RenderStage, string> = {
  idle: 'Preparing to start...',
  initializing: 'Initializing movie project...',
  uploading: 'Uploading image assets...',
  narrating: 'Generating voiceover narration...',
  aligning: 'Generating synchronized captions...',
  composing: 'Creating musical score...',
  rendering: 'Assembling the final movie...',
  polishing: 'Applying Pro Polish (upscale + motion)...',
  done: 'Your movie is ready!',
};

const cachedMessages: Record<RenderStage, string> = {
  idle: 'Preparing to start...',
  initializing: 'Initializing movie project...',
  uploading: 'Using uploaded image assets...',
  narrating: 'Using cached narration...',
  aligning: 'Using cached captions...',
  composing: 'Using cached musical score...',
  rendering: 'Using cached video...',
  polishing: 'Using cached polished video...',
  done: 'Your movie is ready!',
};

import { API_ENDPOINTS, apiCall } from './config/apiConfig';
import { uploadImage, narrate, alignCaptions, composeMusic, renderVideo, polishVideo } from './services/pipelineService';
import { useToast } from './components/ToastProvider';

const RenderingScreen: React.FC<RenderingScreenProps> = ({ scenes, emotion = 'neutral', proPolish = false, projectId: providedProjectId, demoMode = false, onRenderComplete, onRenderFail }) => {
  const [stage, setStage] = useState<RenderStage>('idle');
  const [progress, setProgress] = useState(0); // For uploads, 0 to 100
  const [useCachedMessage, setUseCachedMessage] = useState(false);
  // Defensive context usage to prevent null context errors
  let toast: any = null;
  
  try {
    const toastContext = useToast();
    toast = toastContext.toast;
  } catch (error) {
    console.warn('Toast context not available:', error);
    toast = { info: () => {}, success: () => {}, error: () => {} };
  }

  useEffect(() => {
    const startRenderingProcess = async () => {
      // 1. Initialize project
      setStage('initializing');
      
      // Use provided project ID or create a new one only if none exists
      const projectId = providedProjectId || `movie-${Date.now()}`;
      
      console.log('🎬 RenderingScreen: Starting with projectId:', projectId);
      console.log('🎬 RenderingScreen: providedProjectId was:', providedProjectId);
      
      try {
        // 2. Upload all images
        setStage('uploading');
        // Convert HTTP URLs to data URIs and prepare all images for upload
        const convertHttpUrlToDataUri = async (url: string): Promise<string> => {
          try {
            const response = await fetch(url);
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          } catch (error) {
            console.error('Failed to convert HTTP URL to data URI:', error);
            throw error;
          }
        };

        const allImageUrls = await Promise.all(
          scenes.flatMap((scene, sceneIndex) =>
            (scene.imageUrls || [])
              .filter(url => typeof url === 'string' && url.trim() !== '')
              .map(async (url, imageIndex) => {
                let base64Image: string;
                
                if (url.startsWith('data:image/')) {
                  // Already a data URI
                  base64Image = url;
                } else if (url.startsWith('http://') || url.startsWith('https://')) {
                  // Convert HTTP URL to data URI
                  console.log(`🎬 Converting HTTP URL to data URI: ${url.substring(0, 100)}...`);
                  base64Image = await convertHttpUrlToDataUri(url);
                } else {
                  console.warn(`🎬 Skipping invalid image URL: ${url}`);
                  return null;
                }

                return {
                  base64Image,
                  fileName: `scene-${sceneIndex}-${imageIndex}.png`, // Use .png to match upload service logs
                };
              })
          )
        ).then(results => results.filter(result => result !== null));

        const totalSceneImages = scenes.flatMap(scene => scene.imageUrls || []).length;
        console.log('🎬 Upload debug - Total scene images found:', totalSceneImages);
        console.log('🎬 Upload debug - Images prepared for upload:', allImageUrls.length);
        console.log('🎬 Upload debug - All images will be uploaded to ensure they exist in storage');
        
        if (allImageUrls.length > 0) {
          console.log('🎬 Upload debug - First data URI sample:', {
            fileName: allImageUrls[0].fileName,
            base64Preview: allImageUrls[0].base64Image.substring(0, 100) + '...',
            isValidDataUri: allImageUrls[0].base64Image.startsWith('data:image/')
          });
        }

        if (allImageUrls.length === 0) {
          throw new Error('No valid images found to upload. Make sure all scenes have generated images.');
        }

        // Upload all images to Google Cloud Storage
        let uploadedCount = 0;
        await Promise.all(
          allImageUrls.map(async (image, index) => {
            console.log(`🎬 Upload debug - Uploading image ${index + 1}:`, {
              fileName: image.fileName,
              isValidDataUri: image.base64Image.startsWith('data:image/'),
              dataUriPrefix: image.base64Image.substring(0, 50)
            });
            await uploadImage({ projectId, ...image });
            uploadedCount++;
            setProgress(Math.round((uploadedCount / allImageUrls.length) * 100));
            console.log(`🎬 Upload debug - Successfully uploaded image ${index + 1}`);
          })
        );
        
        console.log(`🎬 Upload complete - ${uploadedCount} images uploaded successfully`);
        
        // Preflight: confirm at least one image per scene is accessible in GCS
        try {
          const bucket = (await import('./config/apiConfig')).apiConfig.firebase.storageBucket;
          const tryExts = ['jpeg','jpg','png','webp'];
          const checkOne = async (sceneIdx: number): Promise<boolean> => {
            for (const ext of tryExts) {
              const url = `https://storage.googleapis.com/${bucket}/${projectId}/scene-${sceneIdx}-0.${ext}`;
              try {
                const resp = await fetch(url, { method: 'GET', cache: 'no-store' });
                if (resp.ok) return true;
              } catch (_) {
                // ignore and try next ext
              }
            }
            return false;
          };
          for (let i = 0; i < scenes.length; i++) {
            const ok = await checkOne(i);
            if (!ok) {
              console.warn(`Preflight: Could not verify scene ${i} asset in storage`);
            }
          }
        } catch (e) {
          console.warn('Preflight storage verification skipped due to error:', e);
        }
        setProgress(100);
        
        // 3. Generate narration
        setStage('narrating');
        setUseCachedMessage(false); // Reset for new stage
        const narrationScript = scenes.map(s => s.narration).join(' ');
        const narrationResponse = await narrate({ projectId, narrationScript, emotion });
        const { gsAudioPath } = narrationResponse;
        
        // Show cached message if response indicates cached result
        if (narrationResponse.cached) {
          setUseCachedMessage(true);
        }

        // 4. Align captions
        setStage('aligning');
        setUseCachedMessage(false); // Reset for new stage
        const alignResponse = await alignCaptions({ projectId, gsAudioPath });
        const { srtPath } = alignResponse;
        
        if (alignResponse.cached) {
          setUseCachedMessage(true);
        }

        // 5. Compose musical score (skip in demo mode)
        let gsMusicPath: string | undefined = undefined;
        if (!demoMode) {
          setStage('composing');
          setUseCachedMessage(false); // Reset for new stage
          const composeResponse = await composeMusic({ projectId, narrationScript });
          gsMusicPath = composeResponse?.gsMusicPath;
          if (composeResponse.cached) {
            setUseCachedMessage(true);
          }
        }

        // 6. Render video
        setStage('rendering');
        setUseCachedMessage(false); // Reset for new stage
        const sceneDataForRender = scenes.map(scene => ({
            narration: scene.narration,
            imageCount: scene.imageUrls?.length || 0,
            camera: scene.camera || 'static',
            transition: scene.transition || 'fade',
            duration: scene.duration || 3,
        }));
        // Assemble with per‑scene motion clips (auto‑generated server‑side), precise captions, and audio
        const renderResponse = await renderVideo({ projectId, scenes: sceneDataForRender, gsAudioPath, srtPath, gsMusicPath, useFal: false, force: true });
        const { videoUrl } = renderResponse;
        
        if (renderResponse.cached) {
          setUseCachedMessage(true);
        }

        // 7. Optional polish
        let finalUrl = videoUrl;
        try { sessionStorage.setItem('lastRenderOriginalUrl', videoUrl); } catch {}
        const polishEnabledFlag = (import.meta as any)?.env?.VITE_ENABLE_POLISH === 'true';
        if (!demoMode && proPolish && polishEnabledFlag) {
          setStage('polishing');
          setUseCachedMessage(false); // Reset for new stage
          try {
            const currentUser = getCurrentUser();
            const polishResponse = await polishVideo({ projectId, videoUrl, userId: currentUser?.uid });
            const { polishedUrl } = polishResponse;
            
            if (polishResponse.cached) {
              setUseCachedMessage(true);
            }
            if (polishedUrl) finalUrl = polishedUrl;
          } catch (e) {
            console.warn('Polish failed, using original video');
            try { toast.info('Polish failed, using original video'); } catch {}
          }
        }
        try { sessionStorage.setItem('lastRenderPolishedUrl', finalUrl); } catch {}

        // 8. Complete
        setStage('done');
        onRenderComplete(finalUrl, projectId);

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
      <h1 className="text-3xl font-bold mt-8 text-white tracking-wide">
        {useCachedMessage ? cachedMessages[stage] : STAGE_MESSAGES[stage]}
      </h1>
      {stage === 'uploading' && <p className="text-gray-400 mt-2">{progress}% complete</p>}
      {renderProgressIndicator()}
      <p className="text-gray-500 mt-12 max-w-lg">
        This can take a few minutes, especially for longer videos. Please don't close this window. We're busy directing, editing, and adding special effects to your masterpiece!
      </p>
    </div>
  );
};

export default RenderingScreen;
