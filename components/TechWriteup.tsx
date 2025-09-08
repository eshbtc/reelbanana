import React from 'react';

const TechWriteup: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-amber-400 mb-4">ReelBanana AI Integration</h1>
          <p className="text-xl text-gray-300">Comprehensive AI-Powered Video Creation Platform</p>
        </div>

        <div className="bg-gray-800 rounded-lg p-8 mb-8 border border-gray-700">
          <h2 className="text-3xl font-bold text-amber-400 mb-6">Google Gemini 2.5 Flash Integration</h2>
          <div className="space-y-4 text-gray-300">
            <p>
              <strong className="text-white">Gemini 2.5 Flash Image Generation:</strong> ReelBanana leverages Google's Gemini 2.5 Flash model for high-quality image generation, creating cinematic visuals from text prompts. The model generates multiple image variants per scene, enabling users to select the best visual representation for their story.
            </p>
            <p>
              <strong className="text-white">Story Generation:</strong> Gemini 2.5 Flash powers our intelligent story creation, transforming user prompts into compelling narratives with detailed scene descriptions, character development, and professional narration scripts.
            </p>
            <p>
              <strong className="text-white">Character & Style Generation:</strong> The model automatically generates character descriptions and visual style guidelines, ensuring consistency across all generated content while maintaining creative flexibility.
            </p>
            <p>
              <strong className="text-white">Central to Application:</strong> Gemini 2.5 Flash is the core AI engine driving ReelBanana's content creation pipeline, from initial concept to final visual assets, making it the foundation of our AI-powered storytelling platform.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-2xl font-bold text-blue-400 mb-4">ElevenLabs Integration</h3>
            <div className="space-y-3 text-gray-300">
              <div>
                <strong className="text-white">Text-to-Speech (TTS):</strong>
                <ul className="ml-4 mt-2 space-y-1">
                  <li>• Professional narration generation</li>
                  <li>• Emotion-controlled voice synthesis</li>
                  <li>• Multiple voice options and styles</li>
                  <li>• High-quality audio output for video narration</li>
                </ul>
              </div>
              <div>
                <strong className="text-white">Music Generation:</strong>
                <ul className="ml-4 mt-2 space-y-1">
                  <li>• AI-composed background music</li>
                  <li>• Genre and mood customization</li>
                  <li>• Seamless audio integration</li>
                  <li>• Professional soundtrack creation</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-2xl font-bold text-purple-400 mb-4">FAL AI Integration</h3>
            <div className="space-y-3 text-gray-300">
              <div>
                <strong className="text-white">Video Generation Models:</strong>
                <ul className="ml-4 mt-2 space-y-1">
                  <li>• <strong>Veo3 Fast:</strong> Image-to-video generation</li>
                  <li>• <strong>LTX Video:</strong> Advanced video synthesis</li>
                  <li>• <strong>MAGI-1:</strong> Creative video effects</li>
                  <li>• <strong>AI Avatar:</strong> Character animation</li>
                  <li>• <strong>Minimax Video:</strong> Motion graphics</li>
                </ul>
              </div>
              <div>
                <strong className="text-white">FFmpeg API:</strong>
                <ul className="ml-4 mt-2 space-y-1">
                  <li>• Video composition and editing</li>
                  <li>• Audio synchronization</li>
                  <li>• Professional video assembly</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-8 mb-8 border border-gray-700">
          <h2 className="text-3xl font-bold text-green-400 mb-6">Complete AI Pipeline</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="bg-amber-500 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-black">1</span>
              </div>
              <h4 className="text-xl font-bold text-white mb-2">Content Creation</h4>
              <p className="text-gray-300">Gemini 2.5 Flash generates stories, characters, and images from text prompts</p>
            </div>
            <div className="text-center">
              <div className="bg-blue-500 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-white">2</span>
              </div>
              <h4 className="text-xl font-bold text-white mb-2">Audio Production</h4>
              <p className="text-gray-300">ElevenLabs creates professional narration and background music</p>
            </div>
            <div className="text-center">
              <div className="bg-purple-500 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-white">3</span>
              </div>
              <h4 className="text-xl font-bold text-white mb-2">Video Assembly</h4>
              <p className="text-gray-300">FAL AI models transform images into dynamic video content</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-8 border border-gray-700">
          <h2 className="text-3xl font-bold text-cyan-400 mb-6">Technical Architecture</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h4 className="text-xl font-bold text-white mb-3">Frontend Technologies</h4>
              <ul className="space-y-2 text-gray-300">
                <li>• React 19 + TypeScript</li>
                <li>• Vite build system</li>
                <li>• Tailwind CSS styling</li>
                <li>• Firebase Authentication</li>
                <li>• Real-time Firestore integration</li>
              </ul>
            </div>
            <div>
              <h4 className="text-xl font-bold text-white mb-3">Backend Infrastructure</h4>
              <ul className="space-y-2 text-gray-300">
                <li>• Google Cloud Run microservices</li>
                <li>• Node.js + Express APIs</li>
                <li>• Google Cloud Storage</li>
                <li>• Firebase Hosting</li>
                <li>• App Check security</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="text-center mt-12">
          <a 
            href="/" 
            className="inline-block bg-amber-500 hover:bg-amber-600 text-black font-bold py-3 px-8 rounded-lg transition-colors"
          >
            ← Back to ReelBanana
          </a>
        </div>
      </div>
    </div>
  );
};

export default TechWriteup;
