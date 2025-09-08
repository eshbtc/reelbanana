import React from 'react';
import { getUpgradeMessage, needsUpgrade } from '../services/freeTierService';
import { useUserCredits } from '../hooks/useUserCredits';
import { CreditPurchaseModal } from './CreditPurchaseModal';
import { useState } from 'react';

interface UpgradePromptProps {
  feature: 'scenes' | 'duration' | 'resolution' | 'watermark' | 'credits';
  currentState: any;
  onUpgrade?: () => void;
  className?: string;
}

export const UpgradePrompt: React.FC<UpgradePromptProps> = ({
  feature,
  currentState,
  onUpgrade,
  className = '',
}) => {
  const { isAdmin } = useUserCredits();
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);

  if (isAdmin) {
    return null; // Admins don't need upgrade prompts
  }

  const needsUpgradeForFeature = needsUpgrade(feature, currentState, isAdmin);
  
  if (!needsUpgradeForFeature) {
    return null;
  }

  const handleUpgrade = () => {
    if (onUpgrade) {
      onUpgrade();
    } else {
      setShowPurchaseModal(true);
    }
  };

  return (
    <>
      <div className={`bg-gradient-to-r from-amber-900/30 to-orange-900/30 border border-amber-500/50 rounded-lg p-4 ${className}`}>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-amber-500/20 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
          
          <div className="flex-1">
            <h3 className="text-amber-200 font-semibold mb-1">Upgrade Required</h3>
            <p className="text-amber-100 text-sm mb-3">
              {getUpgradeMessage(feature)}
            </p>
            
            <div className="flex gap-2">
              <button
                onClick={handleUpgrade}
                className="bg-amber-500 hover:bg-amber-600 text-black font-semibold px-4 py-2 rounded-lg transition-colors text-sm"
              >
                Upgrade Now
              </button>
              <button
                onClick={() => setShowPurchaseModal(true)}
                className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors text-sm"
              >
                Buy Credits
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Credit Purchase Modal */}
      <CreditPurchaseModal
        isOpen={showPurchaseModal}
        onClose={() => setShowPurchaseModal(false)}
        onSuccess={() => {
          // Refresh the page to update credit balance
          window.location.reload();
        }}
      />
    </>
  );
};

/**
 * Component for showing free tier limitations in a compact format
 */
export const FreeTierLimitation: React.FC<{
  limitation: string;
  className?: string;
}> = ({ limitation, className = '' }) => {
  const { isAdmin } = useUserCredits();

  if (isAdmin) {
    return null;
  }

  return (
    <div className={`inline-flex items-center gap-1 text-xs text-gray-400 ${className}`}>
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
      <span>{limitation}</span>
    </div>
  );
};
