
import React, { useState, useCallback, useEffect } from 'react';
import Header from './components/Header';
import StoryboardEditor from './components/StoryboardEditor';
import RenderingScreen from './RenderingScreen';
import MoviePlayer from './components/MoviePlayer';
import PublicGallery from './components/PublicGallery';
import UserDashboard from './components/UserDashboard';
import MyProjectsPage from './components/MyProjectsPage';
import PricingPage from './components/PricingPage';
import { Scene } from './types';
import { getCurrentUser } from './services/authService';
import { API_ENDPOINTS } from './config/apiConfig';
import { authFetch } from './lib/authFetch';
// Removed auto-publish; handled in MoviePlayer for one-click publish UX

type View = 'editor' | 'rendering' | 'player' | 'gallery' | 'dashboard' | 'projects' | 'pricing';

const App: React.FC = () => {
  // Initialize view based on URL path
  const getInitialView = (): View => {
    const path = window.location.pathname;
    if (path === '/projects') return 'projects';
    if (path === '/pricing') return 'pricing';
    if (path === '/gallery') return 'gallery';
    if (path === '/dashboard') return 'dashboard';
    return 'editor';
  };

  const [view, setView] = useState<View>(getInitialView());
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoUrlOriginal, setVideoUrlOriginal] = useState<string | null>(null);
  const [videoUrlPolished, setVideoUrlPolished] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [narrationEmotion, setNarrationEmotion] = useState<string>('neutral');
  const [proPolish, setProPolish] = useState<boolean>(false);
  const [hasFalApiKey, setHasFalApiKey] = useState<boolean>(false);
  
  // Show Polish toggle if VITE_SHOW_POLISH is true OR user has FAL API key
  const showPolish = (import.meta as any)?.env?.VITE_SHOW_POLISH === 'true' || hasFalApiKey;

  // Check for FAL API key when user changes
  useEffect(() => {
    const checkFalApiKey = async () => {
      const currentUser = getCurrentUser();
      if (!currentUser) {
        setHasFalApiKey(false);
        return;
      }

      try {
        const response = await authFetch(`${API_ENDPOINTS.apiKey.check}?keyType=fal`);
        const data = await response.json();
        setHasFalApiKey(data.hasApiKey || false);
      } catch (error) {
        console.error('Error checking FAL API key:', error);
        setHasFalApiKey(false);
      }
    };

    checkFalApiKey();
  }, []);

  const handlePlayMovie = useCallback((movieScenes: Scene[]) => {
    const scenesWithImages = movieScenes.filter(s => s.imageUrls && s.imageUrls.length > 0 && s.status === 'success');
    if (scenesWithImages.length > 0) {
      setScenes(scenesWithImages);
      setView('rendering');
    } else {
      alert("Please generate images for your scenes before creating a movie.");
    }
  }, []);

  const handleRenderComplete = useCallback(async (url: string, projectId?: string) => {
    setVideoUrl(url);
    try {
      const o = sessionStorage.getItem('lastRenderOriginalUrl');
      const p = sessionStorage.getItem('lastRenderPolishedUrl');
      setVideoUrlOriginal(o || url);
      setVideoUrlPolished(p || url);
    } catch {}
    setProjectId(projectId || null);
    setView('player');
  }, [scenes]);

  const handleRenderFail = useCallback((errorMessage: string) => {
    alert(`Movie creation failed:\n\n${errorMessage}\n\nPlease check your backend service logs and configuration.`);
    setView('editor');
  }, []);
  
  const handleBackToEditor = useCallback(() => {
    setView('editor');
    setVideoUrl(null);
    setProjectId(null);
  }, []);

  const handleNavigate = useCallback((newView: 'editor' | 'gallery' | 'dashboard' | 'projects' | 'pricing') => {
    setView(newView);
    
    // Update URL
    const path = newView === 'editor' ? '/' : `/${newView}`;
    window.history.pushState({}, '', path);
    
    if (newView === 'editor') {
      setVideoUrl(null);
      setVideoUrlOriginal(null);
      setVideoUrlPolished(null);
      setProjectId(null);
    }
  }, []);

  const renderContent = () => {
    switch (view) {
      case 'rendering':
        return <RenderingScreen scenes={scenes} emotion={narrationEmotion} proPolish={proPolish} onRenderComplete={handleRenderComplete} onRenderFail={handleRenderFail} />;
      case 'player':
        return <MoviePlayer scenes={scenes} videoUrl={videoUrl} originalUrl={videoUrlOriginal || undefined} polishedUrl={videoUrlPolished || undefined} emotion={narrationEmotion} onBack={handleBackToEditor} projectId={projectId || undefined} />;
      case 'gallery':
        return <PublicGallery />;
      case 'dashboard':
        return <UserDashboard onClose={() => setView('editor')} />;
      case 'projects':
        return <MyProjectsPage />;
      case 'pricing':
        return <PricingPage />;
      case 'editor':
      default:
        return (
          <>
            <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 mb-4">
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-300">Narration Emotion</label>
                <select
                  value={narrationEmotion}
                  onChange={(e) => setNarrationEmotion(e.target.value)}
                  className="bg-gray-900 border border-gray-700 text-white text-sm rounded px-2 py-1"
                >
                  <option value="neutral">Neutral</option>
                  <option value="warm">Warm</option>
                  <option value="excited">Excited</option>
                  <option value="mysterious">Mysterious</option>
                  <option value="dramatic">Dramatic</option>
                </select>
                {showPolish && (
                  <div className="ml-4 flex items-center gap-2">
                    <input id="proPolish" type="checkbox" checked={proPolish} onChange={(e) => setProPolish(e.target.checked)} />
                    <label htmlFor="proPolish" className="text-sm text-gray-300">
                      Pro Polish (Upscale + Interpolate)
                      {hasFalApiKey && <span className="text-orange-400 ml-1">• Using your FAL credits</span>}
                    </label>
                  </div>
                )}
              </div>
            </div>
            <StoryboardEditor onPlayMovie={handlePlayMovie} />
          </>
        );
    }
  };

  return (
    <div className="bg-gray-900 text-white min-h-screen font-sans">
      <Header onNavigate={handleNavigate} currentView={view} />
      <main className="container mx-auto p-4 md:p-8">
        {renderContent()}
      </main>
      <footer className="text-center py-4 text-gray-500 text-sm border-t border-gray-800 mt-8">
        <p>Powered by Google Gemini &amp; ReelBanana AI</p>
      </footer>
    </div>
  );
};

export default App;
