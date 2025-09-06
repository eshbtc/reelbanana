
// Fix: Implement the main App component. This file was previously invalid.
import React, { useState, useCallback } from 'react';
import Header from './components/Header';
import StoryboardEditor from './components/StoryboardEditor';
import RenderingScreen from './RenderingScreen';
import MoviePlayer from './components/MoviePlayer';
import { Scene } from './types';

type View = 'editor' | 'rendering' | 'player';

const App: React.FC = () => {
  const [view, setView] = useState<View>('editor');
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const handlePlayMovie = useCallback((movieScenes: Scene[]) => {
    const scenesWithImages = movieScenes.filter(s => s.imageUrls && s.imageUrls.length > 0 && s.status === 'success');
    if (scenesWithImages.length > 0) {
      setScenes(scenesWithImages);
      setView('rendering');
    } else {
      // In a real app, you might want to show a more integrated alert/modal.
      alert("Please generate images for your scenes before creating a movie.");
    }
  }, []);

  const handleRenderComplete = useCallback((url: string) => {
    setVideoUrl(url);
    setView('player');
  }, []);

  const handleBackToEditor = useCallback(() => {
    setView('editor');
    setVideoUrl(null);
    // We don't clear scenes so the user can continue editing.
  }, []);

  const renderContent = () => {
    switch (view) {
      case 'rendering':
        return <RenderingScreen scenes={scenes} onRenderComplete={handleRenderComplete} onRenderFail={handleBackToEditor} />;
      case 'player':
        return <MoviePlayer scenes={scenes} videoUrl={videoUrl} onBack={handleBackToEditor} />;
      case 'editor':
      default:
        return <StoryboardEditor onPlayMovie={handlePlayMovie} />;
    }
  };

  return (
    <div className="bg-gray-900 text-white min-h-screen font-sans">
      <Header />
      <main className="container mx-auto p-4 md:p-8">
        {renderContent()}
      </main>
      <footer className="text-center py-4 text-gray-500 text-sm border-t border-gray-800 mt-8">
        <p>Powered by Google Gemini &amp; Banana Tech</p>
      </footer>
    </div>
  );
};

export default App;