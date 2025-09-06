import React, { useEffect, useState } from 'react';

interface CompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  leftImages: string[];
  rightImages: string[];
}

const CompareModal: React.FC<CompareModalProps> = ({ isOpen, onClose, leftImages, rightImages }) => {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    const maxLen = Math.max(leftImages.length, rightImages.length);
    const timer = setInterval(() => {
      setFrame((f) => (f + 1) % Math.max(1, maxLen));
    }, 800);
    return () => clearInterval(timer);
  }, [isOpen, leftImages.length, rightImages.length]);

  if (!isOpen) return null;

  const li = leftImages[frame % Math.max(1, leftImages.length)] || leftImages[0];
  const ri = rightImages[frame % Math.max(1, rightImages.length)] || rightImages[0];

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4">
      <div className="bg-gray-900 rounded-lg border border-gray-700 max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h3 className="text-white font-bold text-lg">Compare Variant</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
          <div className="relative">
            <div className="absolute top-2 left-2 bg-black/60 text-white text-xs font-bold px-2 py-1 rounded">Original</div>
            <img src={li} alt="original" className="w-full h-full object-contain bg-black"/>
          </div>
          <div className="relative">
            <div className="absolute top-2 left-2 bg-black/60 text-white text-xs font-bold px-2 py-1 rounded">Variant</div>
            <img src={ri} alt="variant" className="w-full h-full object-contain bg-black"/>
          </div>
        </div>
        <div className="p-3 text-center text-gray-400 text-xs border-t border-gray-800">Frames auto‑advance every 800ms</div>
      </div>
    </div>
  );
};

export default CompareModal;

