import React, { useCallback, useEffect, useMemo, useState } from 'react';
import StripeCard from './StripeCard';
import { getStripeConfig, initializeStripePayment, createSubscription, confirmSubscriptionPayment } from '../services/stripeService';
import { type PlanTier } from '../lib/planMapper';
import { getCurrentUser } from '../services/authService';

interface SubscriptionModalProps {
  open: boolean;
  plan: Extract<PlanTier, 'plus' | 'pro'>; // upgradeable self-serve plans
  onClose: () => void;
  onSuccess?: () => void;
}

const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ open, plan, onClose, onSuccess }) => {
  const [publishableKey, setPublishableKey] = useState<string>('');
  const [stripeConfig, setStripeConfig] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ctx, setCtx] = useState<{ stripe: any; elements: any; card: any } | null>(null);

  const priceId = useMemo(() => {
    if (!stripeConfig?.plans) return null;
    const planConfig = stripeConfig.plans.find((p: any) => p.id === plan);
    return planConfig?.priceId || null;
  }, [stripeConfig, plan]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Check if user is authenticated before loading Stripe config
        const user = getCurrentUser();
        if (!user) {
          setError('Please sign in to access billing features');
          setIsLoading(false);
          return;
        }

        const cfg = await getStripeConfig();
        setPublishableKey(cfg.publishableKey);
        setStripeConfig(cfg);
      } catch (e) {
        console.error(e);
        setError('Failed to load billing configuration');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [open]);

  const handleSubscribe = useCallback(async () => {
    if (!ctx || !publishableKey || !priceId) return;
    setIsSubmitting(true);
    setError(null);
    try {
      // 1) Create PaymentMethod
      const { paymentMethod, error } = await initializeStripePayment(publishableKey, ctx.elements, ctx.card);
      if (error || !paymentMethod?.id) {
        throw new Error(error?.message || 'Failed to create payment method');
      }

      // 2) Create subscription server-side
      const res = await createSubscription(priceId, paymentMethod.id);
      if (!res?.clientSecret) {
        throw new Error('Failed to initialize subscription payment');
      }

      // 3) Confirm payment
      const { error: confirmError } = await confirmSubscriptionPayment(publishableKey, res.clientSecret);
      if (confirmError) {
        throw new Error(confirmError.message || 'Payment confirmation failed');
      }

      onSuccess?.();
      onClose();
    } catch (e: any) {
      console.error('Subscription failed:', e);
      setError(e?.message || 'Subscription failed');
    } finally {
      setIsSubmitting(false);
    }
  }, [ctx, publishableKey, priceId, onClose, onSuccess]);

  if (!open) return null;
  
  return (
    <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-lg max-w-lg w-full overflow-hidden">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-white font-bold text-lg">Upgrade to {plan === 'plus' ? 'Plus' : 'Pro'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        <div className="p-4 space-y-4">
          {isLoading ? (
            <div className="text-gray-400">Loading billing…</div>
          ) : (
            <>
              <div className="space-y-1">
                <div className="text-sm text-gray-300">Payment Method</div>
                {publishableKey ? (
                  <StripeCard publishableKey={publishableKey} onReady={setCtx} />
                ) : (
                  <div className="text-xs text-red-400">Missing Stripe publishable key</div>
                )}
              </div>

              {error && (
                <div className="bg-red-900/20 text-red-300 border border-red-500/40 rounded p-2 text-sm">{error}</div>
              )}

              <div className="flex gap-2 pt-2">
                <button onClick={onClose} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white rounded px-4 py-2">
                  Cancel
                </button>
                <button
                  onClick={handleSubscribe}
                  disabled={isSubmitting || !ctx}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-black font-semibold rounded px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Subscribing…' : 'Subscribe'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubscriptionModal;

