import React, { useState, useEffect } from 'react';
import { useUserCredits } from '../hooks/useUserCredits';
import { getCreditBalance, CreditBalance } from '../services/creditService';
import { formatCredits } from '../utils/costCalculator';
import { CreditPurchaseModal } from './CreditPurchaseModal';

interface CreditBalanceProps {
  showPurchaseButton?: boolean;
  className?: string;
}

export const CreditBalance: React.FC<CreditBalanceProps> = ({
  showPurchaseButton = true,
  className = '',
}) => {
  const { freeCredits, isAdmin, isLoading } = useUserCredits();
  const [detailedBalance, setDetailedBalance] = useState<CreditBalance | null>(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  const loadDetailedBalance = async () => {
    setIsLoadingBalance(true);
    try {
      const balance = await getCreditBalance();
      setDetailedBalance(balance);
    } catch (error) {
      console.error('Error loading detailed balance:', error);
    } finally {
      setIsLoadingBalance(false);
    }
  };

  useEffect(() => {
    if (freeCredits > 0) {
      loadDetailedBalance();
    }
  }, [freeCredits]);

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-gray-400">Loading...</span>
      </div>
    );
  }

  if (isAdmin) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
        <span className="text-green-400 font-semibold">Unlimited Credits</span>
      </div>
    );
  }

  const displayCredits = detailedBalance?.available ?? freeCredits;
  const pendingCredits = detailedBalance?.pending ?? 0;

  return (
    <>
      <div className={`flex items-center gap-3 ${className}`}>
        {/* Credit Balance */}
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
          <span className="text-white font-semibold">
            {formatCredits(displayCredits)}
          </span>
          {pendingCredits > 0 && (
            <span className="text-gray-400 text-sm">
              ({formatCredits(pendingCredits)} pending)
            </span>
          )}
        </div>

        {/* Purchase Button */}
        {showPurchaseButton && (
          <button
            onClick={() => setShowPurchaseModal(true)}
            className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-black text-sm font-semibold rounded-lg transition-colors"
          >
            Buy Credits
          </button>
        )}

        {/* Refresh Button */}
        {isLoadingBalance && (
          <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
        )}
      </div>

      {/* Purchase Modal */}
      <CreditPurchaseModal
        isOpen={showPurchaseModal}
        onClose={() => setShowPurchaseModal(false)}
        onSuccess={() => {
          loadDetailedBalance();
        }}
      />
    </>
  );
};
