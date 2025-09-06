import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type Options = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
};

interface ConfirmContextValue {
  confirm: (opts: Options) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const [opts, setOpts] = useState<Options | null>(null);
  const [resolver, setResolver] = useState<((v: boolean) => void) | null>(null);

  const confirm = useCallback((options: Options) => {
    setOpts(options);
    setVisible(true);
    return new Promise<boolean>((resolve) => {
      setResolver(() => resolve);
    });
  }, []);

  const onClose = useCallback((result: boolean) => {
    setVisible(false);
    const r = resolver;
    setResolver(null);
    if (r) r(result);
  }, [resolver]);

  const value = useMemo(() => ({ confirm }), [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {visible && opts && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-lg max-w-md w-full p-5">
            <div className="mb-3">
              <h3 className="text-lg font-semibold text-white">{opts.title || 'Confirm Action'}</h3>
            </div>
            <div className="text-sm text-gray-300 mb-5">{opts.message}</div>
            <div className="flex justify-end gap-2">
              <button
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded"
                onClick={() => onClose(false)}
              >
                {opts.cancelText || 'Cancel'}
              </button>
              <button
                className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded"
                onClick={() => onClose(true)}
              >
                {opts.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx.confirm;
};

