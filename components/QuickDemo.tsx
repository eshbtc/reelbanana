import React, { useState } from 'react';
// Using emojis instead of lucide-react icons for simplicity
import RenderingScreen from '../RenderingScreen';
import MoviePlayer from './MoviePlayer';

interface QuickDemoProps {
  onBack: () => void;
}

// Pre-defined lightweight demo scenes (isolated from main app)
const DEMO_SCENES = [
  {
    id: 'demo-1',
    narration: "Welcome to ReelBanana.",
    imageUrls: [], // Will be generated
    duration: 2,
    camera: 'static' as const,
    transition: 'fade' as const,
  },
  {
    id: 'demo-2', 
    narration: "AI creates videos fast.",
    imageUrls: [], // Will be generated
    duration: 2,
    camera: 'static' as const,
    transition: 'fade' as const,
  },
  {
    id: 'demo-3',
    narration: "Try it now!",
    imageUrls: [], // Will be generated
    duration: 2,
    camera: 'static' as const,
    transition: 'fade' as const,
  }
];

// Lightweight demo prompts - minimal, simple concepts for fast generation
const DEMO_PROMPTS = [
  "Simple logo text 'ReelBanana', minimal design, blue background",
  "Simple AI icon, robot symbol, clean minimal style, white background", 
  "Simple play button icon, green background, minimal design"
];

const QuickDemo: React.FC<QuickDemoProps> = ({ onBack }) => {
  const [stage, setStage] = useState<'intro' | 'generating' | 'player'>('intro');
  const [scenes, setScenes] = useState(DEMO_SCENES);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);

  const generateDemoVideo = async () => {
    setStage('generating');
    
    try {
      // Generate simple images for each scene
      const scenesWithImages = await Promise.all(
        DEMO_SCENES.map(async (scene, index) => {
          // For demo, we'll create a simple colored placeholder or use a stock image
          // In a real implementation, you'd call your image generation service
          const demoImageUrl = await generateDemoImage(DEMO_PROMPTS[index], index);
          
          return {
            ...scene,
            imageUrls: [demoImageUrl], // Just one image per scene for speed
          };
        })
      );
      
      setScenes(scenesWithImages);
      
      // Generate a unique project ID for this demo
      const demoProjectId = `demo-${Date.now()}`;
      setProjectId(demoProjectId);
      
    } catch (error) {
      console.error('Failed to prepare demo:', error);
      alert('Failed to prepare demo. Please try again.');
      setStage('intro');
    }
  };

  // Simple demo image generation (placeholder)
  const generateDemoImage = async (prompt: string, index: number): Promise<string> => {
    // For now, return a placeholder data URI with different colors
    // In production, this would call your actual image generation API
    const colors = ['#3B82F6', '#10B981', '#F59E0B']; // Blue, Green, Orange
    const color = colors[index];
    
    // Create a simple canvas with text
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      // Background
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 512, 512);
      
      // Add some simple graphics
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.beginPath();
      ctx.arc(256, 256, 150, 0, Math.PI * 2);
      ctx.fill();
      
      // Add text
      ctx.fillStyle = 'white';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`Demo Scene ${index + 1}`, 256, 256);
      
      // Add prompt text (shortened)
      ctx.font = '16px Arial';
      const shortPrompt = prompt.substring(0, 40) + '...';
      ctx.fillText(shortPrompt, 256, 300);
    }
    
    return canvas.toDataURL('image/jpeg', 0.8);
  };

  const handleRenderComplete = (result: { videoUrl: string; projectId: string }) => {
    setVideoUrl(result.videoUrl);
    setStage('player');
  };

  const handleRenderFail = (error: string) => {
    console.error('Demo render failed:', error);
    alert(`Demo failed: ${error}`);
    setStage('intro');
  };

  if (stage === 'generating') {
    return (
      <RenderingScreen 
        scenes={scenes}
        emotion="warm"
        proPolish={false}
        projectId={projectId}
        onRenderComplete={handleRenderComplete}
        onRenderFail={handleRenderFail}
      />
    );
  }

  if (stage === 'player' && videoUrl) {
    return (
      <MoviePlayer
        scenes={scenes}
        videoUrl={videoUrl}
        emotion="warm"
        onBack={onBack}
        projectId={projectId}
      />
    );
  }

  // Intro screen
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-6">
      <div className="max-w-2xl mx-auto text-center">
        {/* Hero Section */}
        <div className="mb-8">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <span className="text-4xl">⚡</span>
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            Quick Demo Video
          </h1>
          <p className="text-xl text-gray-300 mb-8">
            See ReelBanana in action! Generate a 6-second AI video in under 90 seconds.
          </p>
        </div>

        {/* Demo Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-800 rounded-lg p-6">
            <span className="text-2xl mx-auto block mb-3">⏱️</span>
            <h3 className="font-semibold text-white mb-2">Lightning Fast</h3>
            <p className="text-gray-400 text-sm">
              6-second video with 3 simple scenes
            </p>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-6">
            <span className="text-2xl mx-auto block mb-3">🖼️</span>
            <h3 className="font-semibold text-white mb-2">Minimal Assets</h3>
            <p className="text-gray-400 text-sm">
              1 image per scene for speed
            </p>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-6">
            <span className="text-2xl mx-auto block mb-3">🎵</span>
            <h3 className="font-semibold text-white mb-2">Full Pipeline</h3>
            <p className="text-gray-400 text-sm">
              AI narration, music & captions
            </p>
          </div>
        </div>

        {/* Demo Content Preview */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-white mb-4">Demo Video Content:</h3>
          <div className="space-y-3 text-left">
            {DEMO_SCENES.map((scene, index) => (
              <div key={scene.id} className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-xs font-bold">{index + 1}</span>
                </div>
                <div>
                  <p className="text-gray-300 text-sm">{scene.narration}</p>
                  <p className="text-gray-500 text-xs mt-1">
                    {scene.duration}s • {scene.camera} • {scene.transition}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={generateDemoVideo}
            className="flex items-center justify-center gap-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-4 px-8 rounded-lg transition-all duration-200 transform hover:scale-105"
          >
            ▶️
            Generate Demo Video
          </button>
          
          <button
            onClick={onBack}
            className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-4 px-8 rounded-lg transition-colors"
          >
            Back to Editor
          </button>
        </div>

        {/* Fine Print */}
        <p className="text-gray-500 text-sm mt-8">
          This demo uses simplified scenes and placeholder images for speed. 
          The full editor allows unlimited customization and high-quality AI-generated visuals.
        </p>
      </div>
    </div>
  );
};

export default QuickDemo;