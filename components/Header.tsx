import React, { useState } from 'react';
import Logo from './Logo';
import AuthButton from './AuthButton';
import { CreditBalance } from './CreditBalance';
import { Bars3Icon, XMarkIcon } from './Icon';

interface HeaderProps {
  onNavigate?: (view: 'editor' | 'gallery' | 'projects' | 'admin' | 'settings' | 'templates') => void;
  currentView?: 'editor' | 'gallery' | 'projects' | 'admin' | 'settings' | 'templates';
}

const Header: React.FC<HeaderProps> = ({ onNavigate, currentView = 'editor' }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleNavigation = (view: string) => {
    onNavigate?.(view as any);
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="bg-gradient-to-r from-gray-900/90 to-gray-800/90 backdrop-blur-sm border-b border-amber-500/20 sticky top-0 z-50 shadow-lg">
      <div className="container mx-auto px-4 py-3 md:py-4">
        {/* Main header content */}
        <div className="flex items-center justify-between">
          {/* Logo and title */}
          <button 
            onClick={() => onNavigate?.('editor')}
            className="flex items-center gap-2 md:gap-3 hover:opacity-80 transition-opacity cursor-pointer group"
            title="Go to Home"
          >
            <Logo className="w-8 h-8 md:w-12 md:h-12" />
            <div className="hidden sm:block">
              <h1 className="text-2xl md:text-4xl font-bold text-white tracking-tight bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent group-hover:from-amber-300 group-hover:to-orange-400 transition-all">ReelBanana</h1>
              <p className="text-xs md:text-sm text-gray-300 font-medium group-hover:text-gray-200 transition-colors">AI-Powered Cinematic Storytelling</p>
            </div>
            <div className="sm:hidden">
              <h1 className="text-xl font-bold text-white tracking-tight bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">ReelBanana</h1>
            </div>
          </button>
          
          {/* Desktop navigation and auth */}
          <div className="hidden lg:flex items-center gap-6">
            {onNavigate && (
              <nav className="flex items-center gap-2">
                <button
                  onClick={() => onNavigate('editor')}
                  className={`px-3 py-2 rounded-lg transition-colors text-sm ${
                    currentView === 'editor'
                      ? 'bg-amber-500 text-white'
                      : 'text-gray-300 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  Create Movie
                </button>
                <button
                  onClick={() => onNavigate('gallery')}
                  className={`px-3 py-2 rounded-lg transition-colors text-sm ${
                    currentView === 'gallery'
                      ? 'bg-amber-500 text-white'
                      : 'text-gray-300 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  Gallery
                </button>
                <button
                  onClick={() => onNavigate('projects')}
                  className={`px-3 py-2 rounded-lg transition-colors text-sm ${
                    currentView === 'projects'
                      ? 'bg-amber-500 text-white'
                      : 'text-gray-300 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  My Projects
                </button>
                <button
                  onClick={() => onNavigate('templates')}
                  className={`px-3 py-2 rounded-lg transition-colors text-sm ${
                    currentView === 'templates'
                      ? 'bg-amber-500 text-white'
                      : 'text-gray-300 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  Templates
                </button>
                <button
                  onClick={() => onNavigate('admin')}
                  className={`px-3 py-2 rounded-lg transition-colors text-sm ${
                    currentView === 'admin'
                      ? 'bg-red-500 text-white'
                      : 'text-gray-300 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  Admin
                </button>
              </nav>
            )}
            
            <CreditBalance showPurchaseButton={false} />
            <AuthButton onNavigate={onNavigate} />
          </div>

          {/* Mobile menu button and auth */}
          <div className="flex items-center gap-3 lg:hidden">
            <CreditBalance showPurchaseButton={false} className="hidden sm:flex" />
            <AuthButton onNavigate={onNavigate} />
            <button
              onClick={toggleMobileMenu}
              className="p-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="Toggle mobile menu"
            >
              {isMobileMenuOpen ? (
                <XMarkIcon className="w-6 h-6" />
              ) : (
                <Bars3Icon className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile navigation menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden mt-4 pb-4 border-t border-gray-700">
            {/* Mobile credit balance */}
            <div className="px-4 py-3 border-b border-gray-700">
              <CreditBalance showPurchaseButton={true} />
            </div>
            <nav className="flex flex-col gap-2 pt-4">
              <button
                onClick={() => handleNavigation('editor')}
                className={`px-4 py-3 rounded-lg transition-colors text-left ${
                  currentView === 'editor'
                    ? 'bg-amber-500 text-white'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800'
                }`}
              >
                Create Movie
              </button>
              <button
                onClick={() => handleNavigation('gallery')}
                className={`px-4 py-3 rounded-lg transition-colors text-left ${
                  currentView === 'gallery'
                    ? 'bg-amber-500 text-white'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800'
                }`}
              >
                Gallery
              </button>
              <button
                onClick={() => handleNavigation('projects')}
                className={`px-4 py-3 rounded-lg transition-colors text-left ${
                  currentView === 'projects'
                    ? 'bg-amber-500 text-white'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800'
                }`}
              >
                My Projects
              </button>
              <button
                onClick={() => handleNavigation('templates')}
                className={`px-4 py-3 rounded-lg transition-colors text-left ${
                  currentView === 'templates'
                    ? 'bg-amber-500 text-white'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800'
                }`}
              >
                Templates
              </button>
              <button
                onClick={() => handleNavigation('admin')}
                className={`px-4 py-3 rounded-lg transition-colors text-left ${
                  currentView === 'admin'
                    ? 'bg-red-500 text-white'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800'
                }`}
              >
                Admin
              </button>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
