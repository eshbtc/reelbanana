import React, { useEffect, useMemo, useState } from 'react';
import { getStripeConfig, type SubscriptionPlan } from '../services/stripeService';
import { useUserPlan } from '../hooks/useUserPlan';
import { type PlanTier } from '../lib/planMapper';
import SubscriptionModal from './SubscriptionModal';

interface PlanComparisonModalProps {
  open: boolean;
  onClose: () => void;
  suggestedPlan?: Extract<PlanTier, 'plus' | 'pro' | 'studio'>;
}

const ORDER: PlanTier[] = ['free', 'plus', 'pro', 'studio'];

const formatPrice = (n: number) => `$${n}`;

const PlanComparisonModal: React.FC<PlanComparisonModalProps> = ({ open, onClose, suggestedPlan }) => {
  const [cfg, setCfg] = useState<{ plans: SubscriptionPlan[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { planTier: currentPlan } = useUserPlan();
  const [subscribePlan, setSubscribePlan] = useState<false | 'plus' | 'pro'>(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const c = await getStripeConfig();
        setCfg(c as any);
      } catch (e) {
        console.error('Failed to load Stripe config:', e);
        setError('Failed to load plan information');
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  const plans = useMemo(() => {
    const arr = cfg?.plans || [];
    // Ensure four columns in desired order
    return [...arr].sort((a, b) => ORDER.indexOf(a.id as PlanTier) - ORDER.indexOf(b.id as PlanTier));
  }, [cfg]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h3 className="text-white font-bold text-lg">Compare Plans</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-gray-400">Loading plans…</div>
          ) : error ? (
            <div className="text-red-400">{error}</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {plans.map((p) => {
                const isCurrent = (p.id as PlanTier) === currentPlan;
                const isSuggested = suggestedPlan && p.id === suggestedPlan;
                return (
                  <div key={p.id} className={`relative bg-gray-800 rounded-lg p-4 border ${isSuggested ? 'border-amber-500' : 'border-gray-700'}`}>
                    {isCurrent && (
                      <div className="absolute -top-2 left-2">
                        <span className="bg-green-600 text-white text-xs font-semibold px-2 py-0.5 rounded">Current</span>
                      </div>
                    )}
                    {isSuggested && (
                      <div className="absolute -top-2 right-2">
                        <span className="bg-amber-500 text-black text-xs font-semibold px-2 py-0.5 rounded">Suggested</span>
                      </div>
                    )}
                    <div className="text-white font-semibold text-lg mb-1 capitalize">{p.name}</div>
                    <div className="text-amber-400 font-bold text-2xl mb-1">{p.price > 0 ? formatPrice(p.price) : '$0'}<span className="text-sm text-gray-400 font-normal">/{p.interval}</span></div>
                    <div className="text-xs text-gray-400 mb-3">Resolution: {p.limits.resolution} • Max Scenes: {p.limits.maxScenes} • Daily Renders: {p.limits.dailyRenders}</div>
                    <ul className="text-sm text-gray-300 space-y-1 min-h-[120px]">
                      {p.features.map((f) => (
                        <li key={f}>• {f}</li>
                      ))}
                    </ul>
                    <div className="pt-3">
                      {p.id === 'studio' ? (
                        <button
                          onClick={() => window.open('mailto:sales@reelbanana.ai?subject=Studio Plan Inquiry', '_blank')}
                          className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 rounded"
                        >
                          Contact Sales
                        </button>
                      ) : p.id === 'free' ? (
                        <button
                          onClick={onClose}
                          className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 rounded"
                        >
                          Stay on Free
                        </button>
                      ) : (
                        <button
                          onClick={() => setSubscribePlan(p.id as 'plus' | 'pro')}
                          className={`w-full ${isCurrent ? 'bg-gray-700 text-white' : 'bg-amber-600 text-black'} hover:opacity-90 font-semibold py-2 rounded`}
                          disabled={isCurrent}
                        >
                          {isCurrent ? 'Current Plan' : `Choose ${p.name}`}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-800 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded">Close</button>
        </div>
      </div>

      {subscribePlan && (
        <SubscriptionModal
          open={!!subscribePlan}
          plan={subscribePlan}
          onClose={() => setSubscribePlan(false)}
          onSuccess={onClose}
        />
      )}
    </div>
  );
};

export default PlanComparisonModal;

