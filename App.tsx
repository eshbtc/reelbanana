
import React, { useState, useCallback, useEffect } from 'react';
import { useToast } from './components/ToastProvider';
import Header from './components/Header';
import StoryboardEditor from './components/StoryboardEditor';
import RenderingScreen from './RenderingScreen';
import MovieWizard from './components/MovieWizard';
import MoviePlayer from './components/MoviePlayer';
import PublicGallery from './components/PublicGallery';
import { PublicReviewPage } from './components/PublicReviewPage';
import DemoWizardHelpModal from './components/DemoWizardHelpModal';
import MyProjectsPage from './components/MyProjectsPage';
import AdBlockerWarning from './components/AdBlockerWarning';
import AdminDashboard from './components/AdminDashboard';
import TechWriteup from './components/TechWriteup';
import UserDashboard from './components/UserDashboard';
import TemplatesPage from './components/TemplatesPage';
import { Scene } from './types';
import { getCurrentUser } from './services/authService';
import { API_ENDPOINTS } from './config/apiConfig';
import { authFetch } from './lib/authFetch';
// Removed auto-publish; handled in MoviePlayer for one-click publish UX

type View = 'editor' | 'rendering' | 'player' | 'gallery' | 'projects' | 'admin' | 'writeup' | 'settings' | 'templates' | 'publicReview';

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
    if (path.startsWith('/review/')) return 'publicReview';
    if (path === '/projects') return 'projects';
    if (path === '/gallery') return 'gallery';
    if (path === '/admin') return 'admin';
    if (path === '/writeup') return 'writeup';
    if (path === '/settings') return 'settings';
    if (path === '/templates') return 'templates';
    return 'editor';
  };

  const [view, setView] = useState<View>(getInitialView());
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [publicReviewId, setPublicReviewId] = useState<string | null>(null);
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

  const handleRenderComplete = useCallback(async (urlOrResult: string | { videoUrl: string; projectId: string }, projectId?: string) => {
    // Handle both object and string formats
    let videoUrl: string;
    let actualProjectId: string | undefined;
    
    if (typeof urlOrResult === 'object' && urlOrResult.videoUrl) {
      videoUrl = urlOrResult.videoUrl;
      actualProjectId = urlOrResult.projectId;
    } else {
      videoUrl = urlOrResult as string;
      actualProjectId = projectId;
    }
    
    setVideoUrl(videoUrl);
    try {
      const o = sessionStorage.getItem('lastRenderOriginalUrl');
      const p = sessionStorage.getItem('lastRenderPolishedUrl');
      setVideoUrlOriginal(o || videoUrl);
      setVideoUrlPolished(p || videoUrl);
    } catch {}
    setProjectId(actualProjectId || null);
    
    // Save video URLs to project data
    if (actualProjectId) {
      try {
        const { updateProjectWithVideo } = await import('./services/firebaseService');
        await updateProjectWithVideo(actualProjectId, {
          videoUrl,
          videoUrlOriginal: sessionStorage.getItem('lastRenderOriginalUrl') || videoUrl,
          videoUrlPolished: sessionStorage.getItem('lastRenderPolishedUrl') || videoUrl
        });
        console.log('✅ Video URLs saved to project data');
      } catch (error) {
        console.warn('Failed to save video URLs to project:', error);
      }
    }
    
    setView('player');
  }, [scenes]);

  // Effect to handle URL parameters for player view
  useEffect(() => {
    const handleUrlParams = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const projectIdParam = urlParams.get('projectId');
      const viewParam = urlParams.get('view');
      const path = window.location.pathname;
      if (path.startsWith('/review/')) {
        const id = path.split('/review/')[1] || '';
        if (id) {
          setPublicReviewId(id);
          setView('publicReview');
          return;
        }
      }
      
      if (projectIdParam && viewParam === 'player') {
        try {
          const { getProject } = await import('./services/firebaseService');
          const projectData = await getProject(projectIdParam);
          if (projectData && (projectData as any).videoUrl) {
            setProjectId(projectIdParam);
            setVideoUrl((projectData as any).videoUrl);
            setVideoUrlOriginal((projectData as any).videoUrlOriginal || (projectData as any).videoUrl);
            setVideoUrlPolished((projectData as any).videoUrlPolished || (projectData as any).videoUrl);
            setView('player');
          }
        } catch (error) {
          console.error('Failed to load project for player view:', error);
        }
      }
    };
    handleUrlParams();
  }, []);

  // Persist preferences
  useEffect(() => { try { localStorage.setItem('rb_useWizardMode', String(useWizardMode)); } catch {} }, [useWizardMode]);

  const handleRenderFail = useCallback((errorMessage: string) => {
    toast.error(`Movie creation failed: ${errorMessage}`);
    setView('editor');
  }, [toast]);
  
  const handleBackToEditor = useCallback(() => {
    setView('editor');
    setVideoUrl(null);
  }, []);

  const handleLoadTemplate = useCallback(async (templateId: string) => {
    console.log('🎬 Loading template:', templateId);
    
    // Import TEMPLATES to get the template data
    const { TEMPLATES } = await import('./lib/templates');
    const template = TEMPLATES.find(t => t.id === templateId);
    
    if (!template) {
      console.error('🎬 Template not found:', templateId);
      return;
    }
    
    console.log('🎬 Found template:', template.title);
    
    // Navigate to editor first
    setView('editor');
    
    // Store template data to be loaded by StoryboardEditor
    // We'll pass this through a ref or state that StoryboardEditor can access
    window.templateToLoad = template;
  }, []);

  const handleNavigate = useCallback((newView: 'editor' | 'gallery' | 'projects' | 'settings' | 'templates') => {
    setView(newView);
    
    // Update URL
    const path = newView === 'editor' ? '/' : `/${newView}`;
    window.history.pushState({}, '', path);
    
    if (newView === 'editor') {
      setVideoUrl(null);
      setVideoUrlOriginal(null);
      setVideoUrlPolished(null);
    }
  }, []);

  // Sync with browser back/forward
  useEffect(() => {
    const onPopState = () => {
      const path = window.location.pathname;
      if (path.startsWith('/review/')) {
        setView('publicReview');
        const id = path.split('/review/')[1] || '';
        setPublicReviewId(id || null);
      }
      else if (path === '/projects') setView('projects');
      else if (path === '/gallery') setView('gallery');
      else if (path === '/settings') setView('settings');
      else if (path === '/templates') setView('templates');
      else setView('editor');
  };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const renderContent = () => {
    switch (view) {
      case 'publicReview':
        return publicReviewId ? <PublicReviewPage token={publicReviewId} /> : (
          <div className="text-gray-400">Invalid review link</div>
        );
      case 'rendering':
        if (useWizardMode) {
          return <MovieWizard 
            scenes={scenes} 
            emotion={narrationEmotion} 
            proPolish={proPolish} 
            projectId={projectId || 'default-project'}
            demoMode={false}
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
            demoMode={false}
            aspectRatio="16:9"
            exportPreset="web"
            onRenderComplete={handleRenderComplete} 
            onRenderFail={handleRenderFail} 
          />;
        }
      case 'player':
        return <MoviePlayer scenes={scenes} videoUrl={videoUrl} originalUrl={videoUrlOriginal || undefined} polishedUrl={videoUrlPolished || undefined} emotion={narrationEmotion} onBack={handleBackToEditor} projectId={projectId || undefined} />;
      case 'gallery':
        return <PublicGallery />;
      case 'projects':
        return <MyProjectsPage />;
      case 'admin':
        return <AdminDashboard />;
      case 'writeup':
        return <TechWriteup />;
      case 'settings':
        return <UserDashboard onClose={() => setView('editor')} />;
      case 'templates':
        return <TemplatesPage onNavigate={handleNavigate} onLoadTemplate={handleLoadTemplate} />;
      case 'editor':
      default:
        return (
          <>
            <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 mb-4">
              <div className="flex items-center justify-between mb-3">
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
                    <label htmlFor="proPolish" className="text-sm text-gray-300" title="Upscale + frame interpolation for smoother, sharper video. Uses your FAL credits if connected.">
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
                <a 
                  href="/writeup" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="ml-2 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
                >
                  AI Integration Details
                </a>
              </div>
            </div>
            <StoryboardEditor 
              onPlayMovie={handlePlayMovie} 
              onProjectIdChange={(id) => {
                console.log('🎬 App: onProjectIdChange called with:', id);
                setProjectId(id || null);
              }}
              onNavigate={handleNavigate} 
              demoMode={false}
              onExitDemo={() => {}}
            />
            <DemoWizardHelpModal open={showHelp} onClose={() => setShowHelp(false)} />
          </>
        );
    }
  };

  return (
    <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white min-h-screen font-sans">
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
