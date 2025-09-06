import React from 'react';
import Logo from './Logo';
import AuthButton from './AuthButton';

interface HeaderProps {
  onNavigate?: (view: 'editor' | 'gallery') => void;
  currentView?: 'editor' | 'gallery';
}

const Header: React.FC<HeaderProps> = ({ onNavigate, currentView = 'editor' }) => {
  return (
    <header className="bg-gray-900/50 backdrop-blur-sm border-b border-gray-700 sticky top-0 z-10">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo className="w-10 h-10" />
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Reel Banana</h1>
            <p className="text-gray-400">AI-Powered Storytelling</p>
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
                onClick={() => onNavigate('gallery')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  currentView === 'gallery'
                    ? 'bg-amber-500 text-white'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800'
                }`}
              >
                Gallery
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