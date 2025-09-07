import React from 'react';
import Logo from './Logo';
import AuthButton from './AuthButton';

interface HeaderProps {
  onNavigate?: (view: 'editor' | 'gallery' | 'dashboard' | 'projects' | 'demo' | 'meta-demo') => void;
  currentView?: 'editor' | 'gallery' | 'dashboard' | 'projects' | 'demo' | 'meta-demo';
}

const Header: React.FC<HeaderProps> = ({ onNavigate, currentView = 'editor' }) => {
  return (
    <header className="bg-gradient-to-r from-gray-900/90 to-gray-800/90 backdrop-blur-sm border-b border-amber-500/20 sticky top-0 z-10 shadow-lg">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo className="w-12 h-12" />
          <div>
            <h1 className="text-4xl font-bold text-white tracking-tight bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">ReelBanana</h1>
            <p className="text-gray-300 font-medium">AI-Powered Cinematic Storytelling</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          {onNavigate && (
            <nav className="flex items-center gap-4">
              <button
                onClick={() => onNavigate('editor')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  currentView === 'editor'
                    ? 'bg-amber-500 text-white'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800'
                }`}
              >
                Create Movie
              </button>
              <button
                onClick={() => onNavigate('demo')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  currentView === 'demo'
                    ? 'bg-amber-500 text-white'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800'
                }`}
              >
                🎬 Live Demo
              </button>
              <button
                onClick={() => onNavigate('meta-demo')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  currentView === 'meta-demo'
                    ? 'bg-amber-500 text-white'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800'
                }`}
              >
                🎭 Meta Demo
              </button>
              <button
                onClick={() => onNavigate('gallery')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  currentView === 'gallery'
                    ? 'bg-amber-500 text-white'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800'
                }`}
              >
                Gallery
              </button>
              <button
                onClick={() => onNavigate('dashboard')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  currentView === 'dashboard'
                    ? 'bg-amber-500 text-white'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800'
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => onNavigate('projects')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  currentView === 'projects'
                    ? 'bg-amber-500 text-white'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800'
                }`}
              >
                My Projects
              </button>
            </nav>
          )}
          
          <AuthButton />
        </div>
      </div>
    </header>
  );
};

export default Header;
