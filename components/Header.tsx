import React from 'react';
import Logo from './Logo';
import AuthButton from './AuthButton';

interface HeaderProps {
  onNavigate?: (view: 'editor' | 'gallery' | 'projects' | 'admin' | 'settings' | 'templates') => void;
  currentView?: 'editor' | 'gallery' | 'projects' | 'admin' | 'settings' | 'templates';
}

const Header: React.FC<HeaderProps> = ({ onNavigate, currentView = 'editor' }) => {
  return (
    <header className="bg-gradient-to-r from-gray-900/90 to-gray-800/90 backdrop-blur-sm border-b border-amber-500/20 sticky top-0 z-10 shadow-lg">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <button 
          onClick={() => onNavigate?.('editor')}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer group"
          title="Go to Home"
        >
          <Logo className="w-12 h-12" />
          <div>
            <h1 className="text-4xl font-bold text-white tracking-tight bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent group-hover:from-amber-300 group-hover:to-orange-400 transition-all">ReelBanana</h1>
            <p className="text-gray-300 font-medium group-hover:text-gray-200 transition-colors">AI-Powered Cinematic Storytelling</p>
          </div>
        </button>
        
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
                onClick={() => onNavigate('projects')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  currentView === 'projects'
                    ? 'bg-amber-500 text-white'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800'
                }`}
              >
                My Projects
              </button>
              <button
                onClick={() => onNavigate('templates')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  currentView === 'templates'
                    ? 'bg-amber-500 text-white'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800'
                }`}
              >
                Templates
              </button>
              <button
                onClick={() => onNavigate('admin')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  currentView === 'admin'
                    ? 'bg-red-500 text-white'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800'
                }`}
              >
                Admin
              </button>
            </nav>
          )}
          
          <AuthButton onNavigate={onNavigate} />
        </div>
      </div>
    </header>
  );
};

export default Header;
