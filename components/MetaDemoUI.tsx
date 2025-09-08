import React, { useState, useCallback } from 'react';
import { Scene } from '../types';
import { generateImageSequence } from '../services/geminiService';
import { createProject } from '../services/firebaseService';
import { API_ENDPOINTS, apiCall } from '../config/apiConfig';
import { useToast } from './ToastProvider';
import Spinner from './Spinner';

interface MetaDemoUIProps {
  onComplete: (result: { videoUrl: string; projectId: string }) => void;
  onFail: (error: string) => void;
}

type MetaDemoStep = 'intro' | 'input' | 'generating' | 'processing' | 'complete';

const MetaDemoUI: React.FC<MetaDemoUIProps> = ({ onComplete, onFail }) => {
  const [currentStep, setCurrentStep] = useState<MetaDemoStep>('intro');
  const [progress, setProgress] = useState(0);
  const [currentAction, setCurrentAction] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [showResults, setShowResults] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [currentGeneratingScene, setCurrentGeneratingScene] = useState<number>(-1);
  const [imageGenerationProgress, setImageGenerationProgress] = useState<number>(0);
  // Defensive context usage to prevent null context errors
  let toast: any = null;
  try {
    const toastContext = useToast();
    toast = toastContext.toast;
  } catch (error) {
    console.warn('Toast context not available:', error);
    toast = { info: () => {}, success: () => {}, error: () => {} };
  }

  // Meta demo story - "How ReelBanana Created This Demo"
  const metaDemoStory = {
    topic: "How ReelBanana Created This Demo",
    characterStyle: "A professional AI video creation platform interface, modern and sleek design with cinematic lighting",
    scenes: [
      {
        prompt: "A split screen showing traditional video editing software on the left and ReelBanana interface on the right, professional comparison",
        narration: "How do you demo an AI video creation platform? We decided to let ReelBanana create its own demo"
      },
      {
        prompt: "Close-up of hands typing on a keyboard with ReelBanana interface visible, showing text input 'A hero's journey through a magical forest'",
        narration: "We started with a simple prompt about a hero's journey"
      },
      {
        prompt: "Montage of AI generation process: story structure appearing, images being generated, narration waveforms, music notes floating",
        narration: "AI generated our story, created consistent characters, added narration, and composed music"
      },
      {
        prompt: "Final professional video playing on a high-quality screen with cinematic quality indicators and time stamps showing '2 minutes'",
        narration: "The result? A professional demo video, created by AI, in just minutes"
      },
      {
        prompt: "Multiple screens showing different use cases: educational content, marketing videos, entertainment clips, all with ReelBanana branding",
        narration: "Perfect for creators, educators, and marketers. Try it yourself at reel-banana-35a54.web.app"
      }
    ]
  };

  const updateProgress = useCallback((step: number, action: string) => {
    setProgress(step);
    setCurrentAction(action);
  }, []);

  const executeMetaDemoPipeline = useCallback(async () => {
    try {
      setCurrentStep('input');
      updateProgress(10, 'Setting up meta demo...');
      
      // Check if user is authenticated
      const { getCurrentUser } = await import('../services/authService');
      const user = getCurrentUser();
      if (!user) {
        throw new Error('Please sign in to create the meta demo');
      }
      
      // Step 1: Create project for the meta demo
      const newProjectId = await createProject({
        topic: metaDemoStory.topic,
        characterAndStyle: metaDemoStory.characterStyle,
        scenes: metaDemoStory.scenes.map((s, index) => ({
          id: `meta-demo-${index}`,
          prompt: s.prompt,
          narration: s.narration,
          status: 'idle' as const,
        }))
      });
      
      setProjectId(newProjectId);
      updateProgress(20, 'Generating meta demo story...');
      
      // Step 2: Generate images for each scene with animation
      const generatedScenes: Scene[] = [];
      setCurrentStep('generating');
      
      for (let i = 0; i < metaDemoStory.scenes.length; i++) {
        setCurrentGeneratingScene(i);
        setImageGenerationProgress(0);
        
        // Animate progress for this scene
        for (let frame = 0; frame <= 5; frame++) {
          setImageGenerationProgress((frame / 5) * 100);
          updateProgress(20 + (i * 15) + (frame * 3), `Creating scene ${i + 1}: ${metaDemoStory.scenes[i].narration.substring(0, 50)}... (${frame + 1}/5 images)`);
          await new Promise(resolve => setTimeout(resolve, 800)); // 800ms delay for animation
        }
        
        const imageUrls = await generateImageSequence(
          metaDemoStory.scenes[i].prompt,
          metaDemoStory.characterStyle,
          {
            frames: 5,
            projectId: newProjectId,
            sceneIndex: i,
            forceUseApiKey: false
          }
        );
        
        // Ensure we have images for this scene
        if (!imageUrls || imageUrls.length === 0) {
          throw new Error(`No images generated for scene ${i}`);
        }
        
        // Add images to display
        if (Array.isArray(imageUrls)) {
          setGeneratedImages(prev => [...prev, ...imageUrls]);
        } else {
          setGeneratedImages(prev => [...prev, imageUrls]);
        }
        
        generatedScenes.push({
          id: `meta-demo-${i}`,
          prompt: metaDemoStory.scenes[i].prompt,
          narration: metaDemoStory.scenes[i].narration,
          imageUrls,
          status: 'success',
          duration: 3,
          camera: 'zoom-in',
          transition: 'fade'
        });
        
        // Brief pause between scenes for visual effect
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      setCurrentGeneratingScene(-1);
      
      setScenes(generatedScenes);
      updateProgress(80, 'Assembling meta demo video...');
      
      // Step 3: Execute video pipeline
      setCurrentStep('processing');
      
      // Upload assets
      updateProgress(85, 'Uploading demo assets...');
      // Skip upload step since images are already uploaded during generation
      // await apiCall(API_ENDPOINTS.upload, { projectId: newProjectId }, 'Upload failed');
      
      // Generate narration
      updateProgress(90, 'Creating demo narration...');
      const narrationScript = metaDemoStory.scenes.map(s => s.narration).join(' ');
      const narrateResult = await apiCall(API_ENDPOINTS.narrate, {
        projectId: newProjectId,
        narrationScript: narrationScript,
        emotion: 'professional'
      }, 'Narration failed');
      
      // Generate captions
      updateProgress(92, 'Syncing demo captions...');
      console.log('Narrate result:', narrateResult);
      if (!narrateResult.gsAudioPath) {
        throw new Error('Narrate service did not return gsAudioPath');
      }
      await apiCall(API_ENDPOINTS.align, {
        projectId: newProjectId,
        gsAudioPath: narrateResult.gsAudioPath
      }, 'Caption sync failed');
      
      // Generate music
      updateProgress(94, 'Creating demo music...');
      await apiCall(API_ENDPOINTS.compose, {
        projectId: newProjectId,
        narrationScript: narrationScript
      }, 'Music generation failed');
      
      // Generate AI clips and compose video
      updateProgress(80, 'Generating AI scene clips...');
      console.log('Generated scenes for render:', JSON.stringify(generatedScenes, null, 2));
      const renderResult = await apiCall(API_ENDPOINTS.render, {
        projectId: newProjectId,
        scenes: generatedScenes,
        gsAudioPath: narrateResult.gsAudioPath,
        srtPath: `gs://reel-banana-35a54.firebasestorage.app/${newProjectId}/captions.srt`,
        useFal: true,
        force: true
      }, 'Video rendering failed');
      updateProgress(96, 'Composing final video...');
      
      // Finalize
      const finalVideoUrl = renderResult.videoUrl;
      setVideoUrl(finalVideoUrl);
      
      updateProgress(100, 'Meta demo complete!');
      setCurrentStep('complete');
      setShowResults(true);
      
      toast.success('Meta demo created successfully!');
      
      // Auto-complete after showing results
      setTimeout(() => {
        onComplete({ videoUrl: finalVideoUrl, projectId: newProjectId });
      }, 5000);
      
    } catch (error) {
      console.error('Meta demo pipeline failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Meta demo failed';
      toast.error(errorMessage);
      onFail(errorMessage);
    }
  }, [metaDemoStory, updateProgress, onComplete, onFail, toast]);

  const startMetaDemo = () => {
    executeMetaDemoPipeline();
  };

  const getButtonText = () => {
    switch (currentStep) {
      case 'intro':
        return '🎬 Create Meta Demo';
      case 'input':
        return '⏳ Setting Up...';
      case 'generating':
        return '🎨 Generating Demo...';
      case 'processing':
        return '🎬 Assembling Video...';
      case 'complete':
        return '🎉 View Meta Demo';
      default:
        return '🚀 Start Meta Demo';
    }
  };

  const isButtonDisabled = () => {
    return currentStep === 'input' || currentStep === 'generating' || currentStep === 'processing';
  };

  return (
    <>
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
        
        .animate-fadeInUp {
          animation: fadeInUp 0.5s ease-out;
        }
        
        .animate-pulse-slow {
          animation: pulse 2s ease-in-out infinite;
        }
      `}</style>
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-8">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold text-white mb-4">
            🎬 ReelBanana
          </h1>
          <p className="text-xl text-blue-200 mb-8">
            Meta Demo: "How ReelBanana Created This Demo"
          </p>
        </div>

        {/* Main Content */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
          {currentStep === 'intro' && (
            <div className="text-center">
              <h2 className="text-3xl font-bold text-white mb-6">
                The Ultimate Meta Demo
              </h2>
              <div className="bg-white/20 rounded-lg p-6 mb-8">
                <p className="text-lg text-blue-100 mb-4">
                  <strong>Demo Script:</strong> "How ReelBanana Created This Demo"
                </p>
                <div className="text-left text-sm text-blue-200 space-y-2">
                  <p><strong>Scene 1:</strong> The Challenge - "How do you demo an AI video creation platform?"</p>
                  <p><strong>Scene 2:</strong> The Process - "We started with a simple prompt about a hero's journey"</p>
                  <p><strong>Scene 3:</strong> AI Magic - "AI generated our story, created consistent characters..."</p>
                  <p><strong>Scene 4:</strong> The Result - "A professional demo video, created by AI, in just minutes"</p>
                  <p><strong>Scene 5:</strong> The Impact - "Perfect for creators, educators, and marketers"</p>
                </div>
              </div>
              
              {/* Authentication Check */}
              <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4 mb-6">
                <p className="text-blue-200 text-sm">
                  🔐 <strong>Note:</strong> You need to be signed in to create the meta demo. 
                  Please sign in using the button in the header above.
                </p>
              </div>
              
              <button
                onClick={startMetaDemo}
                disabled={isButtonDisabled()}
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-bold py-4 px-8 rounded-lg text-xl transition-all duration-300 transform hover:scale-105 shadow-lg"
              >
                {getButtonText()}
              </button>
            </div>
          )}

          {(currentStep === 'input' || currentStep === 'generating' || currentStep === 'processing') && (
            <div className="text-center">
              <div className="mb-8">
                <Spinner size="large" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-4">
                {currentStep === 'input' ? 'Setting Up Meta Demo' : 
                 currentStep === 'generating' ? 'AI is Creating the Demo' : 
                 'Assembling the Meta Demo Video'}
              </h2>
              <p className="text-lg text-blue-200 mb-6">
                {currentAction}
              </p>
              
              {/* Progress Bar */}
              <div className="w-full bg-white/20 rounded-full h-4 mb-4">
                <div 
                  className="bg-gradient-to-r from-amber-500 to-orange-500 h-4 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-blue-300">
                {progress}% Complete
              </p>

              {/* Animated Image Generation Display */}
              {currentStep === 'generating' && (
                <div className="mt-8">
                  <div className="bg-white/10 rounded-lg p-6">
                    <h3 className="text-lg font-bold text-white mb-4 text-center">
                      🎨 AI Image Generation in Progress
                    </h3>
                    
                    {/* Current Scene Info */}
                    {currentGeneratingScene >= 0 && (
                      <div className="text-center mb-4">
                        <p className="text-blue-200 mb-2">
                          Scene {currentGeneratingScene + 1}: {metaDemoStory.scenes[currentGeneratingScene]?.narration.substring(0, 60)}...
                        </p>
                        <div className="w-full bg-white/20 rounded-full h-3 mb-2">
                          <div 
                            className="bg-gradient-to-r from-purple-500 to-pink-500 h-3 rounded-full transition-all duration-500"
                            style={{ width: `${imageGenerationProgress}%` }}
                          />
                        </div>
                        <p className="text-sm text-blue-300">
                          {Math.round(imageGenerationProgress)}% Complete
                        </p>
                      </div>
                    )}
                    
                    {/* Generated Images Grid */}
                    {generatedImages.length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                        {generatedImages.map((imageUrl, index) => (
                          <div 
                            key={index}
                            className="relative group overflow-hidden rounded-lg bg-white/5 border border-white/10"
                          >
                            <img 
                              src={imageUrl} 
                              alt={`Generated scene ${Math.floor(index / 5) + 1}`}
                              className="w-full h-24 object-cover transition-transform duration-300 group-hover:scale-105"
                              style={{
                                animation: 'fadeInUp 0.5s ease-out',
                                animationDelay: `${index * 0.1}s`
                              }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="absolute bottom-1 left-1 text-xs text-white">
                                Scene {Math.floor(index / 5) + 1}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Loading Animation for Current Generation */}
                    {currentGeneratingScene >= 0 && generatedImages.length < (currentGeneratingScene + 1) * 5 && (
                      <div className="flex justify-center items-center py-8">
                        <div className="relative">
                          <div className="w-16 h-16 border-4 border-white/20 border-t-purple-500 rounded-full animate-spin"></div>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full animate-pulse"></div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Meta Demo Features */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                <div className="bg-white/10 rounded-lg p-4 text-center">
                  <div className="text-2xl mb-2">🎭</div>
                  <p className="text-sm text-blue-200">Meta Story</p>
                </div>
                <div className="bg-white/10 rounded-lg p-4 text-center">
                  <div className="text-2xl mb-2">🖼️</div>
                  <p className="text-sm text-blue-200">Demo Images</p>
                </div>
                <div className="bg-white/10 rounded-lg p-4 text-center">
                  <div className="text-2xl mb-2">🎵</div>
                  <p className="text-sm text-blue-200">Demo Music</p>
                </div>
                <div className="bg-white/10 rounded-lg p-4 text-center">
                  <div className="text-2xl mb-2">🎬</div>
                  <p className="text-sm text-blue-200">Meta Video</p>
                </div>
              </div>

              {/* Processing Button */}
              <div className="mt-8">
                <button
                  disabled={true}
                  className="bg-gradient-to-r from-gray-600 to-gray-700 text-white font-bold py-4 px-8 rounded-lg text-xl cursor-not-allowed opacity-75"
                >
                  {getButtonText()}
                </button>
              </div>
            </div>
          )}

          {currentStep === 'complete' && showResults && (
            <div className="text-center">
              <div className="mb-8">
                <div className="text-6xl mb-4">🎉</div>
                <h2 className="text-3xl font-bold text-white mb-4">
                  Meta Demo Complete!
                </h2>
                <p className="text-lg text-blue-200 mb-4">
                  ReelBanana just created its own demo video using AI!
                </p>
                <div className="bg-white/10 rounded-lg p-4 mb-6">
                  <p className="text-sm text-blue-300 mb-2">Meta Demo Story:</p>
                  <p className="text-white font-medium">"{metaDemoStory.topic}"</p>
                </div>
              </div>

              {/* Video Player */}
              {videoUrl && (
                <div className="mb-8">
                  <video
                    src={(videoUrl || '').replace(/(^https?:\/\/firebasestorage\.googleapis\.com\/v0\/b\/)([^/]+)(\/o\/)([^?]+).*/i, (_, p1, b, p3, enc) => `https://storage.googleapis.com/${b}/${decodeURIComponent(enc)}`)}
                    controls
                    className="w-full max-w-2xl mx-auto rounded-lg shadow-2xl"
                    poster={scenes[0]?.imageUrls?.[0]}
                    muted
                    playsInline
                    preload="metadata"
                    autoPlay
                    onError={(e) => {
                      const target = e.target as HTMLVideoElement;
                      console.error('Video loading error:', e);
                      console.error('Video URL:', videoUrl);
                      console.error('Video error:', target.error);
                    }}
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              )}

              {/* Meta Demo Results */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white/10 rounded-lg p-6 text-center">
                  <div className="text-3xl mb-2">🤖</div>
                  <h3 className="text-lg font-bold text-white mb-2">AI Created</h3>
                  <p className="text-blue-200">Demo created entirely by AI</p>
                </div>
                <div className="bg-white/10 rounded-lg p-6 text-center">
                  <div className="text-3xl mb-2">⏱️</div>
                  <h3 className="text-lg font-bold text-white mb-2">Meta Speed</h3>
                  <p className="text-blue-200">Demo about creating demos</p>
                </div>
                <div className="bg-white/10 rounded-lg p-6 text-center">
                  <div className="text-3xl mb-2">🎯</div>
                  <h3 className="text-lg font-bold text-white mb-2">Self-Demo</h3>
                  <p className="text-blue-200">Platform demonstrates itself</p>
                </div>
              </div>

              {/* Call to Action */}
              <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-lg p-6 border border-amber-500/30">
                <h3 className="text-xl font-bold text-white mb-2">
                  The Ultimate Meta Demo
                </h3>
                <p className="text-blue-200 mb-4">
                  ReelBanana just created its own demo video using AI. This is the future of content creation.
                </p>
                <a
                  href="https://reel-banana-35a54.web.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105"
                >
                  🚀 Try ReelBanana Now
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-blue-300 text-sm">
            Meta Demo: AI creating its own demo video
          </p>
        </div>
      </div>
      </div>
    </>
  );
};

export default MetaDemoUI;
