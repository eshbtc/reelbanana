import React, { useState, useEffect } from 'react';

const AdBlockerWarning: React.FC = () => {
  const [showWarning, setShowWarning] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check if user has dismissed the warning before
    const dismissed = localStorage.getItem('adblocker-warning-dismissed');
    if (dismissed) {
      setIsDismissed(true);
      return;
    }

    // Listen for Firestore connection errors
    const handleError = (event: ErrorEvent) => {
      if (event.message && event.message.includes('ERR_BLOCKED_BY_CLIENT')) {
        setShowWarning(true);
      }
    };

    // Listen for unhandled promise rejections (Firestore errors)
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (event.reason && event.reason.message && event.reason.message.includes('ERR_BLOCKED_BY_CLIENT')) {
        setShowWarning(true);
      }
    };

    // Listen for console errors
    const originalConsoleError = console.error;
    console.error = (...args) => {
      const message = args.join(' ');
      if (message.includes('ERR_BLOCKED_BY_CLIENT') || 
          message.includes('Failed to load resource') ||
          message.includes('firestore.googleapis.com') ||
          message.includes('net::ERR_BLOCKED_BY_CLIENT')) {
        setShowWarning(true);
      }
      originalConsoleError.apply(console, args);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      console.error = originalConsoleError;
    };
  }, []);

  const handleDismiss = () => {
    setShowWarning(false);
    setIsDismissed(true);
    localStorage.setItem('adblocker-warning-dismissed', 'true');
  };

  const handleDismissPermanently = () => {
    setShowWarning(false);
    setIsDismissed(true);
    localStorage.setItem('adblocker-warning-dismissed', 'true');
    localStorage.setItem('adblocker-warning-permanent', 'true');
  };

  if (!showWarning || isDismissed) {
    return null;
  }

  return (
    <div className="fixed top-4 left-4 right-4 z-[10000] bg-yellow-900/90 border border-yellow-500 rounded-lg p-4 backdrop-blur-sm">
      <div className="flex items-start gap-3">
        <div className="text-yellow-400 text-xl">⚠️</div>
        <div className="flex-1">
          <h3 className="text-yellow-200 font-semibold mb-2">Ad Blocker Detected</h3>
          <p className="text-yellow-100 text-sm mb-3">
            Your ad blocker is preventing ReelBanana from connecting to its database. This will cause features like project saving, user authentication, and API key storage to fail.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={handleDismiss}
              className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-sm rounded transition-colors"
            >
              I'll fix this later
            </button>
            <button
              onClick={handleDismissPermanently}
              className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded transition-colors"
            >
              Don't show again
            </button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-yellow-400 hover:text-yellow-300 text-xl"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default AdBlockerWarning;
