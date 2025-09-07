
import React, { useState, useCallback, useEffect } from 'react';
import { useToast } from './components/ToastProvider';
import Header from './components/Header';
import StoryboardEditor from './components/StoryboardEditor';
import RenderingScreen from './RenderingScreen';
import MovieWizard from './components/MovieWizard';
import MoviePlayer from './components/MoviePlayer';
import PublicGallery from './components/PublicGallery';
import DemoWizardHelpModal from './components/DemoWizardHelpModal';
import UserDashboard from './components/UserDashboard';
import MyProjectsPage from './components/MyProjectsPage';
import AdBlockerWarning from './components/AdBlockerWarning';
import { Scene } from './types';
import { getCurrentUser } from './services/authService';
import { API_ENDPOINTS } from './config/apiConfig';
import { authFetch } from './lib/authFetch';
// Removed auto-publish; handled in MoviePlayer for one-click publish UX

type View = 'editor' | 'rendering' | 'player' | 'gallery' | 'dashboard' | 'projects';

const App: React.FC = () => {
  // Defensive context usage to prevent null context errors
  let toast: any = null;
  
  try {
    const toastContext = useToast();
    toast = toastContext.toast;
  } catch (error) {
    console.warn('Toast context not available:', error);
    toast = { info: () => {}, success: () => {}, error: () => {} };
  }
  // Initialize view based on URL path
  const getInitialView = (): View => {
    const path = window.location.pathname;
    if (path === '/projects') return 'projects';
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
  const [useWizardMode, setUseWizardMode] = useState<boolean>(() => {
    try { return localStorage.getItem('rb_useWizardMode') === 'false' ? false : true; } catch { return true; }
  });
  const [showHelp, setShowHelp] = useState<boolean>(false);
  const [demoMode, setDemoMode] = useState<boolean>(() => {
    try { return localStorage.getItem('rb_demoMode') === 'true'; } catch { return false; }
  });
  
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
      console.log('🎬 App: handlePlayMovie called with projectId:', projectId);
      setScenes(scenesWithImages);
      setView('rendering');
    } else {
      toast.info('Please generate images for your scenes before creating a movie.', 3000);
    }
  }, [projectId]);

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

  // Persist preferences
  useEffect(() => { try { localStorage.setItem('rb_useWizardMode', String(useWizardMode)); } catch {} }, [useWizardMode]);
  useEffect(() => { try { localStorage.setItem('rb_demoMode', String(demoMode)); } catch {} }, [demoMode]);

  const handleRenderFail = useCallback((errorMessage: string) => {
    toast.error(`Movie creation failed: ${errorMessage}`);
    setView('editor');
  }, [toast]);
  
  const handleBackToEditor = useCallback(() => {
    setView('editor');
    setVideoUrl(null);
    setProjectId(null);
  }, []);

  const handleNavigate = useCallback((newView: 'editor' | 'gallery' | 'dashboard' | 'projects') => {
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

  // Sync with browser back/forward
  useEffect(() => {
    const onPopState = () => {
      const path = window.location.pathname;
      if (path === '/projects') setView('projects');
      else if (path === '/gallery') setView('gallery');
      else if (path === '/dashboard') setView('dashboard');
      else setView('editor');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const renderContent = () => {
    switch (view) {
      case 'rendering':
        if (useWizardMode) {
          return <MovieWizard 
            scenes={scenes} 
            emotion={narrationEmotion} 
            proPolish={proPolish} 
            projectId={projectId || 'default-project'}
            demoMode={demoMode}
            onComplete={handleRenderComplete} 
            onFail={handleRenderFail}
            onBack={handleBackToEditor}
          />;
        } else {
          return <RenderingScreen 
            scenes={scenes} 
            emotion={narrationEmotion} 
            proPolish={proPolish} 
            projectId={projectId || undefined} 
            demoMode={demoMode}
            onRenderComplete={handleRenderComplete} 
            onRenderFail={handleRenderFail} 
          />;
        }
      case 'player':
        return <MoviePlayer scenes={scenes} videoUrl={videoUrl} originalUrl={videoUrlOriginal || undefined} polishedUrl={videoUrlPolished || undefined} emotion={narrationEmotion} onBack={handleBackToEditor} projectId={projectId || undefined} />;
      case 'gallery':
        return <PublicGallery />;
      case 'dashboard':
        return <UserDashboard onClose={() => setView('editor')} />;
      case 'projects':
        return <MyProjectsPage />;
      case 'editor':
      default:
        return (
          <>
            <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 mb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <input 
                      id="demoMode" 
                      type="checkbox" 
                      checked={demoMode} 
                      onChange={(e) => setDemoMode(e.target.checked)} 
                      className="rounded"
                    />
                    <label htmlFor="demoMode" className="text-sm text-gray-300 font-medium">
                      Demo Mode
                    </label>
                  </div>
                  {demoMode && (
                    <div className="flex items-center gap-3">
                      <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">6-sec video</span>
                      <span className="text-xs bg-green-600 text-white px-2 py-1 rounded">Ultra fast</span>
                      <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded">Simple scenes</span>
                    </div>
                  )}
                  {!demoMode && (
                    <span className="text-gray-400 text-sm">Pro Mode: Full customization & quality</span>
                  )}
                </div>
              </div>
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
                <div className="flex items-center gap-2">
                  <input id="wizardMode" type="checkbox" checked={useWizardMode} onChange={(e) => setUseWizardMode(e.target.checked)} />
                  <label htmlFor="wizardMode" className="text-sm text-gray-300">
                    Wizard Mode (Step-by-step control)
                  </label>
                </div>
                <button onClick={() => setShowHelp(true)} className="ml-2 text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded">
                  Help
                </button>
              </div>
            </div>
            <StoryboardEditor 
              onPlayMovie={handlePlayMovie} 
              onProjectIdChange={(id) => {
                console.log('🎬 App: onProjectIdChange called with:', id);
                setProjectId(id || null);
              }} 
              demoMode={demoMode}
              onExitDemo={() => setDemoMode(false)}
            />
            <DemoWizardHelpModal open={showHelp} onClose={() => setShowHelp(false)} />
          </>
        );
    }
  };

  return (
    <div className="bg-gray-900 text-white min-h-screen font-sans">
      <AdBlockerWarning />
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
