import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type ToastType = 'info' | 'success' | 'error';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  toast: {
    info: (msg: string, duration?: number) => void;
    success: (msg: string, duration?: number) => void;
    error: (msg: string, duration?: number) => void;
  };
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const push = useCallback((type: ToastType, message: string, duration = 3000) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const item: ToastItem = { id, type, message, duration };
    setToasts(prev => [...prev, item]);
    if (duration > 0) {
      setTimeout(() => remove(id), duration);
    }
  }, [remove]);

  const value: ToastContextValue = useMemo(() => ({
    toast: {
      info: (m, d) => push('info', m, d),
      success: (m, d) => push('success', m, d),
      error: (m, d) => push('error', m, d),
    }
  }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-[10000] space-y-2">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`min-w-[260px] max-w-sm px-4 py-3 rounded shadow border text-sm transition-opacity bg-gray-900/95 backdrop-blur border-gray-700 ${
              t.type === 'success' ? 'text-green-300' : t.type === 'error' ? 'text-red-300' : 'text-gray-200'
            }`}
            role="status"
            aria-live="polite"
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

