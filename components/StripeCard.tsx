import React, { useEffect, useRef, useState } from 'react';

interface StripeCardProps {
  publishableKey: string;
  onReady?: (ctx: { stripe: any; elements: any; card: any }) => void;
  className?: string;
}

// Lightweight Stripe Card Element mounting without @stripe/react-stripe-js
const StripeCard: React.FC<StripeCardProps> = ({ publishableKey, onReady, className = '' }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let stripeInstance: any = null;
    let elements: any = null;
    let card: any = null;
    let canceled = false;

    const mount = async () => {
      try {
        const { loadStripe } = await import('@stripe/stripe-js');
        stripeInstance = await loadStripe(publishableKey);
        if (!stripeInstance || !containerRef.current || canceled) return;
        elements = stripeInstance.elements();
        card = elements.create('card', {
          hidePostalCode: true,
          style: {
            base: {
              color: '#fff',
              '::placeholder': { color: '#9ca3af' },
              fontSize: '16px',
            },
            invalid: { color: '#f87171' },
          },
        } as any);
        card.mount(containerRef.current);
        setMounted(true);
        onReady?.({ stripe: stripeInstance, elements, card });
      } catch (e) {
        console.error('Failed to mount Stripe card:', e);
      }
    };

    mount();

    return () => {
      canceled = true;
      try { card?.unmount?.(); } catch {}
      try { card?.destroy?.(); } catch {}
      setMounted(false);
    };
  }, [publishableKey, onReady]);

  return (
    <div className={className}>
      <div ref={containerRef} className="bg-gray-900 border border-gray-700 rounded px-3 py-2" />
      {!mounted && (
        <div className="text-xs text-gray-400 mt-2">Loading payment form…</div>
      )}
    </div>
  );
};

export default StripeCard;

