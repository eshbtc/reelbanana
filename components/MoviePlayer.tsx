// MoviePlayer component with social sharing capabilities
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useToast } from './ToastProvider';
import { Scene } from '../types';
import { publishMovie } from '../services/firebaseService';
import { API_ENDPOINTS, apiCall } from '../config/apiConfig';

interface MoviePlayerProps {
  scenes: Scene[];
  videoUrl: string | null;
  originalUrl?: string;
  polishedUrl?: string;
  onBack: () => void;
  projectId?: string; // For sharing functionality
  emotion?: string;
}

const MoviePlayer: React.FC<MoviePlayerProps> = ({ scenes, videoUrl, originalUrl, polishedUrl, onBack, projectId, emotion = 'neutral' }) => {
  const [shareUrl, setShareUrl] = useState<string>('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [published, setPublished] = useState(false);
  const [usePolished, setUsePolished] = useState<boolean>(true);
  const [playbackTracked, setPlaybackTracked] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const srcUrl = usePolished ? (polishedUrl || videoUrl || '') : (originalUrl || videoUrl || '');
  
  // Defensive context usage to prevent null context errors
  let toast: any = null;
  
  try {
    const toastContext = useToast();
    toast = toastContext.toast;
  } catch (error) {
    console.warn('Toast context not available:', error);
    toast = { info: () => {}, success: () => {}, error: () => {} };
  }

  const styleBadges = useMemo(() => {
    const styles = Array.from(new Set((scenes || [])
      .map(s => s.stylePreset)
      .filter((v): v is string => !!v && v !== 'none')));
    return styles;
  }, [scenes]);

  // Track playback success for SLI monitoring
  const trackPlaybackSuccess = async (success: boolean, error?: string) => {
    if (!projectId || playbackTracked) return;
    
    try {
      // Send playback tracking to a monitoring endpoint
      await apiCall(API_ENDPOINTS.playbackTracking, {
        projectId,
        success,
        error,
        timestamp: new Date().toISOString(),
        videoType: usePolished ? 'polished' : 'original'
      }, 'Failed to track playback');
      
      setPlaybackTracked(true);
    } catch (error) {
      console.warn('Failed to track playback:', error);
    }
  };

  // Video event handlers for playback tracking
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleCanPlay = () => {
      trackPlaybackSuccess(true);
    };

    const handleError = (e: Event) => {
      const error = e.target instanceof HTMLVideoElement ? 
        `Video error: ${e.target.error?.message || 'Unknown error'}` : 
        'Unknown video error';
      trackPlaybackSuccess(false, error);
      // Auto-fallback to original if polished fails
      try {
        if (usePolished && polishedUrl) {
          console.warn('Polished playback failed, falling back to original video');
          setUsePolished(false);
        }
      } catch {}
    };

    const handleLoadStart = () => {
      // Reset tracking when video starts loading
      setPlaybackTracked(false);
    };

    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('error', handleError);
    video.addEventListener('loadstart', handleLoadStart);

    return () => {
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);
      video.removeEventListener('loadstart', handleLoadStart);
    };
  }, [videoUrl, usePolished, projectId, playbackTracked]);

  const handleShare = async () => {
    // Always route through publish flow to create proper /share/:id URLs
    if (!published) {
      // If not published yet, open publish modal first
      setShowPublishModal(true);
    } else {
      // If already published, show share modal
      setShowShareModal(true);
    }
  };

  const shareToX = () => {
    const url = shareUrl || videoUrl || window.location.href;
    const text = encodeURIComponent('Check out my AI-generated movie on ReelBanana! #AI #ReelBanana');
    const u = encodeURIComponent(url || '');
    const xUrl = `https://twitter.com/intent/tweet?text=${text}&url=${u}`;
    window.open(xUrl, '_blank');
  };
  
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied to clipboard');
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      toast.error('Failed to copy link');
    }
  };

  const handleOpenPublish = () => {
    setTitle(`ReelBanana Movie ${new Date().toLocaleString()}`);
    setDescription('');
    setShowPublishModal(true);
  };

  const handlePublish = async () => {
    if (!videoUrl || !projectId) return;
    setPublishing(true);
    try {
      // Ensure a durable URL by asking render service to mark as published
      let durableUrl = videoUrl;
      try {
        const r = await apiCall(API_ENDPOINTS.render, { projectId, published: true }, 'Failed to finalize published video URL');
        durableUrl = r?.videoUrl || videoUrl;
      } catch (e) {
        console.warn('Durable URL request failed, falling back to current URL:', e);
      }

      const thumb = scenes[0]?.imageUrls?.[0];
      const id = await publishMovie({ title, description, videoUrl: durableUrl, thumbnailUrl: thumb });
      setPublished(true);
      const origin = window?.location?.origin || '';
      setShareUrl(`${origin}/share/${id}`);
      setShowPublishModal(false);
      setShowShareModal(true);
    } catch (e) {
      console.error('Publish failed:', e);
      toast.error('Publish failed. Please try again.');
    } finally {
      setPublishing(false);
    }
  };
  return (
    <div className="flex flex-col items-center">
      <div className="w-full max-w-4xl">
        <div className="relative mb-6" style={{ paddingBottom: '56.25%' /* 16:9 aspect ratio */ }}>
          {(videoUrl || originalUrl || polishedUrl) ? (
            <video
              ref={videoRef}
              className="absolute top-0 left-0 w-full h-full rounded-lg shadow-2xl bg-black"
              key={(usePolished ? 'polished-' : 'original-') + (srcUrl || 'empty')}
              src={srcUrl}
              controls
              autoPlay
              muted
              playsInline
              preload="metadata"
              loop
            >
              Your browser does not support the video tag.
            </video>
          ) : (
            <div className="absolute top-0 left-0 w-full h-full rounded-lg bg-gray-800 flex items-center justify-center">
              <p className="text-gray-400">No video to display.</p>
            </div>
          )}
          {/* On-screen badges over player */}
          <div className="absolute top-2 left-2 flex gap-2 flex-wrap">
            <div className="bg-black/60 text-white text-xs font-bold px-2 py-1 rounded">Emotion: {emotion}</div>
            {styleBadges.length > 0 && (
              <div className="bg-black/60 text-white text-xs font-bold px-2 py-1 rounded">Styles: {styleBadges.join(', ').replace(/-/g,' ')}</div>
            )}
          </div>
          {/* Original vs Polished toggle */}
          {(polishedUrl || originalUrl) && (
            <div className="absolute top-2 right-2 bg-black/60 text-white text-xs font-bold rounded flex overflow-hidden">
              <button onClick={() => setUsePolished(false)} className={`px-2 py-1 ${!usePolished ? 'bg-amber-500' : ''}`}>Original</button>
              <button onClick={() => setUsePolished(true)} className={`px-2 py-1 ${usePolished ? 'bg-amber-500' : ''}`}>Polished</button>
            </div>
          )}
        </div>
        {/* Debug link for playback issues */}
        {srcUrl && (
          <div className="text-center mb-2">
            <a href={srcUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-400 underline">Open video in new tab</a>
          </div>
        )}
        <div className="text-center space-x-4">
          <button
            onClick={onBack}
            className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-8 rounded-lg transition-colors text-lg"
          >
            Back to Editor
          </button>
          {(videoUrl || polishedUrl || originalUrl) && (
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
          {(videoUrl || polishedUrl || originalUrl) && (
            <button
              onClick={shareToX}
              className="bg-sky-500 hover:bg-sky-600 text-white font-bold py-3 px-8 rounded-lg transition-colors text-lg"
            >
              Share to X
            </button>
          )}
          {videoUrl && !published && (
            <button
              onClick={handleOpenPublish}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg transition-colors text-lg"
            >
              Publish to Gallery
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
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

      {/* Publish Modal */}
      {showPublishModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-white mb-4">Publish to Gallery</h3>
            <div className="space-y-3 mb-4">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter a title"
                className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a brief description (optional)"
                rows={3}
                className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowPublishModal(false)}
                className="flex-1 bg-gray-600 hover:bg-gray-500 text-white py-2 rounded transition-colors"
                disabled={publishing}
              >
                Cancel
              </button>
              <button
                onClick={handlePublish}
                disabled={publishing || !title.trim()}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white py-2 rounded transition-colors"
              >
                {publishing ? 'Publishing...' : 'Publish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MoviePlayer;
