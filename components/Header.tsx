import React from 'react';
import Logo from './Logo';

const Header: React.FC = () => {
  return (
    <header className="bg-gray-900/50 backdrop-blur-sm border-b border-gray-700 sticky top-0 z-10">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo className="w-10 h-10" />
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Reel Banana</h1>
            <p className="text-gray-400">AI-Powered Storyboarding</p>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;