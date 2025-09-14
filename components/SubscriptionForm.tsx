import React, { useState, useRef, useEffect } from 'react';
import { createSubscription, confirmSubscriptionPayment } from '../services/stripeService';
import { getStripeConfig } from '../services/stripeService';
import Spinner from './Spinner';

interface SubscriptionFormProps {
  planId: string;
  planName: string;
  price: number;
  onSuccess: (subscriptionId: string) => void;
  onError: (error: string) => void;
  onCancel: () => void;
}

const SubscriptionForm: React.FC<SubscriptionFormProps> = ({
  planId,
  planName,
  price,
  onSuccess,
  onError,
  onCancel
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishableKey, setPublishableKey] = useState<string>('');
  const [stripeInstance, setStripeInstance] = useState<any>(null);
  const [elements, setElements] = useState<any>(null);
  const [card, setCard] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  // Initialize Stripe on mount
  useEffect(() => {
    let canceled = false;

    const initializeStripe = async () => {
      try {
        const config = await getStripeConfig();
        setPublishableKey(config.publishableKey);
        
        const { loadStripe } = await import('@stripe/stripe-js');
        const stripe = await loadStripe(config.publishableKey);
        
        if (!stripe || !containerRef.current || canceled) return;
        
        const elements = stripe.elements();
        const cardElement = elements.create('card', {
          hidePostalCode: true,
          style: {
            base: {
              color: '#fff',
              '::placeholder': { color: '#9ca3af' },
              fontSize: '16px',
            },
            invalid: { color: '#f87171' },
          },
        });
        
        cardElement.mount(containerRef.current);
        
        if (!canceled) {
          setStripeInstance(stripe);
          setElements(elements);
          setCard(cardElement);
          setMounted(true);
        }
      } catch (e) {
        console.error('Failed to initialize Stripe:', e);
        if (!canceled) {
          setError('Failed to load payment system');
        }
      }
    };

    initializeStripe();

    return () => {
      canceled = true;
      try { card?.unmount?.(); } catch {}
      try { card?.destroy?.(); } catch {}
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripeInstance || !card) {
      setError('Payment system not ready');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Create payment method using the card element
      const { error: pmError, paymentMethod } = await stripeInstance.createPaymentMethod({
        type: 'card',
        card: card,
      });

      if (pmError) {
        throw new Error(pmError.message || 'Failed to create payment method');
      }

      if (!paymentMethod) {
        throw new Error('Payment method creation failed');
      }

      // Create subscription
      const { subscriptionId, clientSecret } = await createSubscription(
        planId,
        paymentMethod.id
      );

      // Confirm payment
      const { subscription, error: confirmError } = await confirmSubscriptionPayment(
        publishableKey,
        clientSecret
      );

      if (confirmError) {
        throw new Error(confirmError.message || 'Payment confirmation failed');
      }

      if (subscription && subscription.status === 'active') {
        onSuccess(subscriptionId);
      } else {
        throw new Error('Subscription not activated');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Subscription failed';
      setError(errorMessage);
      onError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };


  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-2">Subscription Details</h3>
        <div className="flex justify-between items-center">
          <span className="text-gray-300">{planName} Plan</span>
          <span className="text-xl font-bold text-amber-500">${price}/month</span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Card Information
        </label>
        <div className="bg-gray-700 border border-gray-600 rounded-lg p-3">
          <div ref={containerRef} />
          {!mounted && (
            <div className="text-xs text-gray-400 mt-2">Loading payment form…</div>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-500 text-red-300 p-3 rounded-lg">
          <p className="font-medium">Payment Error</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
          disabled={isProcessing}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripeInstance || !mounted || isProcessing}
          className="flex-1 px-4 py-3 bg-amber-500 hover:bg-amber-600 text-black font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <>
              <Spinner size="sm" />
              Processing...
            </>
          ) : (
            `Subscribe for $${price}/month`
          )}
        </button>
      </div>

      <div className="text-xs text-gray-400 text-center">
        🔒 Secure payment processing by Stripe. Your payment information is encrypted and secure.
      </div>
    </form>
  );
};

export default SubscriptionForm;
