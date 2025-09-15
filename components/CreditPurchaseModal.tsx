import React, { useCallback, useEffect, useState } from 'react';
import Modal from './Modal';
import Spinner from './Spinner';
import { CREDIT_PACKAGES, formatPrice, formatCredits } from '../utils/costCalculator';
import { purchaseCredits } from '../services/creditService';
import { useUserCredits } from '../hooks/useUserCredits';
import { getStripeConfig, initializeStripePayment } from '../services/stripeService';
import StripeCard from './StripeCard';
import { getCurrentUser } from '../services/authService';

interface CreditPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CreditPurchaseModal: React.FC<CreditPurchaseModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [selectedPackage, setSelectedPackage] = useState<string>('creator');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { refreshCredits } = useUserCredits();
  const [publishableKey, setPublishableKey] = useState<string>('');
  const [ctx, setCtx] = useState<{ stripe: any; elements: any; card: any } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // Check if user is authenticated before loading Stripe config
        const user = getCurrentUser();
        if (!user) {
          console.log('User not authenticated, skipping Stripe config load');
          return;
        }

        const cfg = await getStripeConfig();
        setPublishableKey(cfg.publishableKey);
      } catch (e) {
        console.error('Failed to load Stripe config:', e);
      }
    })();
  }, []);

  const handlePurchase = async () => {
    if (!selectedPackage) return;

    setIsProcessing(true);
    setError(null);

    try {
      if (!publishableKey || !ctx) {
        throw new Error('Payment form not ready');
      }
      // Create a payment method via Stripe Elements
      const { paymentMethod, error } = await initializeStripePayment(publishableKey, ctx.elements, ctx.card);
      if (error || !paymentMethod?.id) {
        throw new Error(error?.message || 'Failed to create payment method');
      }

      const result = await purchaseCredits(selectedPackage, paymentMethod.id);
      
      if (result.success) {
        await refreshCredits();
        onSuccess?.();
        onClose();
      } else {
        setError(result.error || 'Purchase failed');
      }
    } catch (error) {
      console.error('Credit purchase error:', error);
      setError(error instanceof Error ? error.message : 'Purchase failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const selectedPackageData = CREDIT_PACKAGES.find(pkg => pkg.id === selectedPackage);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Purchase Credits">
      <div className="space-y-6">
        {/* Package Selection */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">Choose a Credit Package</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {CREDIT_PACKAGES.map((pkg) => (
              <div
                key={pkg.id}
                className={`relative p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedPackage === pkg.id
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-gray-600 bg-gray-800 hover:border-gray-500'
                }`}
                onClick={() => setSelectedPackage(pkg.id)}
              >
                {pkg.popular && (
                  <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                    <span className="bg-amber-500 text-black text-xs font-bold px-2 py-1 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}
                
                <div className="text-center">
                  <h4 className="text-xl font-bold text-white mb-2">{pkg.name}</h4>
                  <div className="text-3xl font-bold text-amber-500 mb-2">
                    {formatPrice(pkg.price)}
                  </div>
                  <div className="text-gray-300 mb-3">
                    {formatCredits(pkg.credits)} • {formatPrice(pkg.pricePerCredit)}/credit
                  </div>
                  <p className="text-sm text-gray-400">{pkg.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Selected Package Summary */}
        {selectedPackageData && (
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <h4 className="text-lg font-semibold text-white mb-3">Order Summary</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-gray-300">
                <span>{selectedPackageData.name}</span>
                <span>{formatCredits(selectedPackageData.credits)}</span>
              </div>
              <div className="flex justify-between text-gray-300">
                <span>Price per credit</span>
                <span>{formatPrice(selectedPackageData.pricePerCredit)}</span>
              </div>
              <div className="border-t border-gray-600 pt-2">
                <div className="flex justify-between text-white font-semibold">
                  <span>Total</span>
                  <span>{formatPrice(selectedPackageData.price)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-900/20 border border-red-500 text-red-300 p-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Payment Method */}
        <div>
          <h4 className="text-sm font-semibold text-white mb-2">Payment Method</h4>
          {publishableKey ? (
            <StripeCard publishableKey={publishableKey} onReady={setCtx} />
          ) : (
            <div className="text-xs text-red-400">Unable to load payment form</div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
            disabled={isProcessing}
          >
            Cancel
          </button>
          <button
            onClick={handlePurchase}
            disabled={isProcessing || !selectedPackage || !ctx}
            className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <Spinner size="sm" />
                Processing...
              </>
            ) : (
              `Purchase for ${selectedPackageData ? formatPrice(selectedPackageData.price) : ''}`
            )}
          </button>
        </div>

        {/* Security Notice */}
        <div className="text-xs text-gray-400 text-center">
          🔒 Secure payment processing by Stripe. Your payment information is encrypted and secure.
        </div>
      </div>
    </Modal>
  );
};
