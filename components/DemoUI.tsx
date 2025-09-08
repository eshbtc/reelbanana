import React, { useState, useEffect, useCallback } from 'react';
import { Scene } from '../types';
import { generateStory, generateCharacterAndStyle, generateImageSequence } from '../services/geminiService';
import { createProject, updateProject } from '../services/firebaseService';
import { API_ENDPOINTS, apiCall } from '../config/apiConfig';
import { getCurrentUser } from '../services/authService';
import { useToast } from './ToastProvider';
import Spinner from './Spinner';

interface DemoUIProps {
  onComplete: (result: { videoUrl: string; projectId: string }) => void;
  onFail: (error: string) => void;
}

type DemoStep = 'input' | 'generating' | 'processing' | 'complete';

const DemoUI: React.FC<DemoUIProps> = ({ onComplete, onFail }) => {
  const [currentStep, setCurrentStep] = useState<DemoStep>('input');
  const [progress, setProgress] = useState(0);
  const [currentAction, setCurrentAction] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [showResults, setShowResults] = useState(false);
  
  const { toast } = useToast();

  // Demo input state
  const [userInput, setUserInput] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('fantasy');
  const [showInput, setShowInput] = useState(true);
  
  // Style presets for demo
  const stylePresets = [
    { id: 'fantasy', name: 'Fantasy', description: 'Magical and mystical' },
    { id: 'sci-fi', name: 'Sci-Fi', description: 'Futuristic and technological' },
    { id: 'noir', name: 'Film Noir', description: 'Dark and dramatic' },
    { id: 'comedy', name: 'Comedy', description: 'Light and humorous' }
  ];

  const updateProgress = useCallback((step: number, action: string) => {
    setProgress(step);
    setCurrentAction(action);
  }, []);

  const executeDemoPipeline = useCallback(async () => {
    try {
      if (!userInput.trim()) {
        toast.error('Please enter a story idea to get started!');
        return;
      }
      
      setShowInput(false);
      setCurrentStep('generating');
      updateProgress(10, 'Generating story structure...');
      
      // Step 1: Generate story from user input
      const [storyScenes, characterStyle] = await Promise.all([
        generateStory(userInput, false),
        generateCharacterAndStyle(userInput, false)
      ]);
      
      // Step 2: Create project
      const newProjectId = await createProject({
        topic: userInput,
        characterAndStyle: characterStyle,
        scenes: storyScenes.map((s, index) => ({
          id: `demo-${index}`,
          prompt: s.prompt,
          narration: s.narration,
          status: 'idle' as const,
        }))
      });
      
      setProjectId(newProjectId);
      updateProgress(20, 'Creating character style...');
      
      // Step 3: Generate images for each scene
      const generatedScenes: Scene[] = [];
      for (let i = 0; i < storyScenes.length; i++) {
        updateProgress(20 + (i * 15), `Generating scene ${i + 1} images...`);
        
        let cachedInfo: { cached?: boolean } | undefined;
        const imageUrls = await generateImageSequence(
          storyScenes[i].prompt,
          characterStyle,
          {
            frames: 5,
            projectId: newProjectId,
            sceneIndex: i,
            forceUseApiKey: false,
            onInfo: (info) => { cachedInfo = info; }
          }
        );
        
        generatedScenes.push({
          id: `demo-${i}`,
          prompt: storyScenes[i].prompt,
          narration: storyScenes[i].narration,
          imageUrls,
          status: 'success',
          cached: !!cachedInfo?.cached,
          duration: 3,
          camera: 'zoom-in',
          transition: 'fade'
        });
      }
      
      setScenes(generatedScenes);
      updateProgress(80, 'Assembling final video...');
      
      // Step 3: Execute video pipeline
      setCurrentStep('processing');
      
      // Upload assets
      updateProgress(85, 'Uploading assets...');
      await apiCall(API_ENDPOINTS.upload, { projectId: newProjectId }, 'Upload failed');
      
      // Generate narration
      updateProgress(90, 'Creating narration...');
      const narrateResult = await apiCall(API_ENDPOINTS.narrate, {
        projectId: newProjectId,
        emotion: 'adventurous'
      }, 'Narration failed');
      
      // Generate captions
      updateProgress(92, 'Syncing captions...');
      await apiCall(API_ENDPOINTS.align, {
        projectId: newProjectId,
        audioPath: narrateResult.audioPath
      }, 'Caption sync failed');
      
      // Generate music
      updateProgress(94, 'Creating musical score...');
      await apiCall(API_ENDPOINTS.compose, {
        projectId: newProjectId,
        emotion: 'adventurous'
      }, 'Music generation failed');
      
      // Render video
      updateProgress(96, 'Rendering video...');
      const renderResult = await apiCall(API_ENDPOINTS.render, {
        projectId: newProjectId,
        useFal: false,
        force: true
      }, 'Video rendering failed');
      
      // Apply polish
      updateProgress(98, 'Applying pro polish...');
      const polishResult = await apiCall(API_ENDPOINTS.polish, {
        projectId: newProjectId,
        videoUrl: renderResult.videoUrl
      }, 'Polish failed');
      
      const finalVideoUrl = polishResult.polishedUrl || renderResult.videoUrl;
      setVideoUrl(finalVideoUrl);
      
      updateProgress(100, 'Complete!');
      setCurrentStep('complete');
      setShowResults(true);
      
      // Auto-complete after showing results
      setTimeout(() => {
        onComplete({ videoUrl: finalVideoUrl, projectId: newProjectId });
      }, 3000);
      
    } catch (error) {
      console.error('Demo pipeline failed:', error);
      onFail(error instanceof Error ? error.message : 'Demo failed');
    }
  }, [userInput, updateProgress, onComplete, onFail]);

  const startDemo = () => {
    executeDemoPipeline();
  };

  const getButtonText = () => {
    switch (currentStep) {
      case 'input':
        return '🚀 Create My Video';
      case 'generating':
        return '⏳ Generating...';
      case 'processing':
        return '🎬 Assembling Video...';
      case 'complete':
        return '🎉 View Results';
      default:
        return '🚀 Start Demo';
    }
  };

  const isButtonDisabled = () => {
    if (currentStep === 'input') {
      return !userInput.trim();
    }
    return currentStep === 'generating' || currentStep === 'processing';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-8">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold text-white mb-4">
            🎬 ReelBanana
          </h1>
          <p className="text-xl text-blue-200 mb-8">
            AI-Powered Video Creation Platform
          </p>
        </div>

        {/* Main Content */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
          {currentStep === 'input' && showInput && (
            <div className="text-center">
              <h2 className="text-3xl font-bold text-white mb-6">
                Create Professional Videos with AI
              </h2>
              <div className="bg-white/20 rounded-lg p-6 mb-8">
                <p className="text-lg text-blue-100 mb-6">
                  Enter your story idea and watch AI transform it into a professional video
                </p>
                
                {/* Story Input */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-blue-200 mb-2">
                    What's your story about?
                  </label>
                  <textarea
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder="A brave astronaut discovers a mysterious planet with ancient ruins..."
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-blue-300 focus:outline-none focus:border-amber-500 resize-none"
                    rows={3}
                  />
                </div>
                
                {/* Style Selection */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-blue-200 mb-3">
                    Choose a visual style:
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {stylePresets.map((style) => (
                      <button
                        key={style.id}
                        onClick={() => setSelectedStyle(style.id)}
                        className={`p-3 rounded-lg border transition-all ${
                          selectedStyle === style.id
                            ? 'border-amber-500 bg-amber-500/20 text-amber-200'
                            : 'border-white/20 bg-white/10 text-blue-200 hover:border-white/40'
                        }`}
                      >
                        <div className="font-medium">{style.name}</div>
                        <div className="text-xs opacity-80">{style.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              
              <button
                onClick={startDemo}
                disabled={isButtonDisabled()}
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-bold py-4 px-8 rounded-lg text-xl transition-all duration-300 transform hover:scale-105 shadow-lg"
              >
                {getButtonText()}
              </button>
            </div>
          )}

          {(currentStep === 'generating' || currentStep === 'processing') && (
            <div className="text-center">
              <div className="mb-8">
                <Spinner size="large" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-4">
                {currentStep === 'generating' ? 'AI is Creating Your Story' : 'Assembling Your Video'}
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

              {/* Feature Highlights */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                <div className="bg-white/10 rounded-lg p-4 text-center">
                  <div className="text-2xl mb-2">🎨</div>
                  <p className="text-sm text-blue-200">AI Story Generation</p>
                </div>
                <div className="bg-white/10 rounded-lg p-4 text-center">
                  <div className="text-2xl mb-2">🖼️</div>
                  <p className="text-sm text-blue-200">Cinematic Images</p>
                </div>
                <div className="bg-white/10 rounded-lg p-4 text-center">
                  <div className="text-2xl mb-2">🎵</div>
                  <p className="text-sm text-blue-200">Custom Music</p>
                </div>
                <div className="bg-white/10 rounded-lg p-4 text-center">
                  <div className="text-2xl mb-2">🎬</div>
                  <p className="text-sm text-blue-200">Video Assembly</p>
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
                  Your AI Video is Ready!
                </h2>
                <p className="text-lg text-blue-200 mb-4">
                  Professional-quality cinematic video created in minutes, not hours.
                </p>
                <div className="bg-white/10 rounded-lg p-4 mb-6">
                  <p className="text-sm text-blue-300 mb-2">Your Story:</p>
                  <p className="text-white font-medium">"{userInput}"</p>
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
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              )}

              {/* Results Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white/10 rounded-lg p-6 text-center">
                  <div className="text-3xl mb-2">⏱️</div>
                  <h3 className="text-lg font-bold text-white mb-2">Speed</h3>
                  <p className="text-blue-200">Created in under 2 minutes</p>
                </div>
                <div className="bg-white/10 rounded-lg p-6 text-center">
                  <div className="text-3xl mb-2">🎯</div>
                  <h3 className="text-lg font-bold text-white mb-2">Quality</h3>
                  <p className="text-blue-200">Professional cinematic output</p>
                </div>
                <div className="bg-white/10 rounded-lg p-6 text-center">
                  <div className="text-3xl mb-2">🤖</div>
                  <h3 className="text-lg font-bold text-white mb-2">AI-Powered</h3>
                  <p className="text-blue-200">Multi-modal AI pipeline</p>
                </div>
              </div>

              {/* Call to Action */}
              <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-lg p-6 border border-amber-500/30">
                <h3 className="text-xl font-bold text-white mb-2">
                  Ready to Create Your Own?
                </h3>
                <p className="text-blue-200 mb-4">
                  Try ReelBanana and transform your ideas into professional videos.
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
            Powered by Google Gemini, ElevenLabs, and Fal AI
          </p>
        </div>
      </div>
    </div>
  );
};

export default DemoUI;
