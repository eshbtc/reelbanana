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
        <div className="text-center space-x-4">
          <button
            onClick={onBack}
            className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-8 rounded-lg transition-colors text-lg"
          >
            Back to Editor
          </button>
          {videoUrl && (
            <button
              onClick={handleShare}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-lg transition-colors text-lg flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
              </svg>
              Share Movie
            </button>
          )}
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

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-white mb-4">Share Your Movie</h3>
            <p className="text-gray-300 mb-4">
              Copy this link to share your movie with friends and family!
            </p>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="flex-1 bg-gray-700 text-white px-3 py-2 rounded border border-gray-600"
              />
              <button
                onClick={copyToClipboard}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition-colors"
              >
                Copy
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowShareModal(false)}
                className="flex-1 bg-gray-600 hover:bg-gray-500 text-white py-2 rounded transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MoviePlayer;