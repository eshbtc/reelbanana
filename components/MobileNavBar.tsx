import React from 'react';

interface MobileNavBarProps {
  onScrollScenes?: () => void;
  onScrollCharacter?: () => void;
  onGenerateAll?: () => void;
  onOpenComments?: () => void;
  onOpenHistory?: () => void;
}

const MobileNavBar: React.FC<MobileNavBarProps> = ({ onScrollScenes, onScrollCharacter, onGenerateAll, onOpenComments, onOpenHistory }) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-gray-900/95 border-t border-gray-800 backdrop-blur supports-[backdrop-filter]:bg-gray-900/80">
      <div className="max-w-6xl mx-auto px-3 py-2">
        <div className="grid grid-cols-5 gap-2 text-xs text-gray-200">
          <button onClick={onScrollScenes} className="flex flex-col items-center justify-center py-2 active:opacity-80">
            <span>🎬</span>
            <span>Scenes</span>
          </button>
          <button onClick={onScrollCharacter} className="flex flex-col items-center justify-center py-2 active:opacity-80">
            <span>🎭</span>
            <span>Character</span>
          </button>
          <button onClick={onGenerateAll} className="flex flex-col items-center justify-center py-2 active:opacity-80 text-amber-300">
            <span>⚡️</span>
            <span>Generate</span>
          </button>
          <button onClick={onOpenComments} className="flex flex-col items-center justify-center py-2 active:opacity-80">
            <span>💬</span>
            <span>Comments</span>
          </button>
          <button onClick={onOpenHistory} className="flex flex-col items-center justify-center py-2 active:opacity-80">
            <span>🕘</span>
            <span>History</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MobileNavBar;

