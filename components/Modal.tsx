
import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  panelClassName?: string; // Optional class override for the inner panel
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children, panelClassName }) => {
  if (!isOpen) return null;

  // Close on Escape
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] transition-opacity p-4"
      onClick={onClose}
    >
      <div 
        className={`${panelClassName || 'bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6 border border-gray-700'} max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};

export default Modal;
