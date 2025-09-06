// MoviePlayer component with social sharing capabilities
import React, { useState } from 'react';
import { Scene } from '../types';

interface MoviePlayerProps {
  scenes: Scene[];
  videoUrl: string | null;
  onBack: () => void;
  projectId?: string; // For sharing functionality
}

const MoviePlayer: React.FC<MoviePlayerProps> = ({ scenes, videoUrl, onBack, projectId }) => {
  const [shareUrl, setShareUrl] = useState<string>('');
  const [showShareModal, setShowShareModal] = useState(false);

  const handleShare = async () => {
    if (!projectId) {
      // Generate a shareable URL
      const shareId = `share-${Date.now()}`;
      const baseUrl = window.location.origin;
      const url = `${baseUrl}/?share=${shareId}`;
      setShareUrl(url);
      setShowShareModal(true);
      
      // Copy to clipboard
      try {
        await navigator.clipboard.writeText(url);
        // Could add a toast notification here
      } catch (err) {
        console.error('Failed to copy to clipboard:', err);
      }
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      // Could add a toast notification here
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };
  return (
    <div className="flex flex-col items-center">
      <div className="w-full max-w-4xl">
        <div className="relative mb-6" style={{ paddingBottom: '56.25%' /* 16:9 aspect ratio */ }}>
          {videoUrl ? (
            <video
              className="absolute top-0 left-0 w-full h-full rounded-lg shadow-2xl bg-black"
              src={videoUrl}
              controls
              autoPlay
              loop
            >
              Your browser does not support the video tag.
            </video>
          ) : (
            <div className="absolute top-0 left-0 w-full h-full rounded-lg bg-gray-800 flex items-center justify-center">
              <p className="text-gray-400">No video to display.</p>
            </div>
          )}
        </div>
        <div className="text-center">
          <button
            onClick={onBack}
            className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-8 rounded-lg transition-colors text-lg"
          >
            Back to Editor
          </button>
        </div>
      </div>
      
      <div className="mt-12 w-full max-w-6xl">
        <h3 className="text-2xl font-bold mb-4 text-center text-gray-300">Movie Scenes</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {scenes.map((scene, index) => (
            <div key={scene.id} className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
              <div className="relative h-32 bg-gray-700">
                {scene.imageUrls && scene.imageUrls.length > 0 && (
                  <img src={scene.imageUrls[0]} alt={`Scene ${index + 1}`} className="w-full h-full object-cover" />
                )}
                 <div className="absolute top-2 left-2 bg-black/50 text-white text-xs font-bold px-2 py-1 rounded">
                  Scene {index + 1}
                </div>
              </div>
              <div className="p-3">
                <p className="text-sm text-gray-400 leading-tight">{scene.narration}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MoviePlayer;