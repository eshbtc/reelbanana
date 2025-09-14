import { useState, useEffect, useCallback } from 'react';
import { getSubscriptionStatus } from '../services/stripeService';
import { mapPlanIdToTier, getPlanConfig, PlanTier, PlanInfo } from '../lib/planMapper';

interface UseUserPlanReturn {
  planTier: PlanTier;
  planConfig: PlanInfo;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to manage user plan state and subscription status
 */
export function useUserPlan(): UseUserPlanReturn {
  const [planTier, setPlanTier] = useState<PlanTier>('free');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlan = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const subscriptionStatus = await getSubscriptionStatus();
      const tier = mapPlanIdToTier(subscriptionStatus.plan);
      
      setPlanTier(tier);
    } catch (err) {
      console.error('Failed to fetch user plan:', err);
      setError(err instanceof Error ? err.message : 'Failed to load plan');
      // Default to free plan on error
      setPlanTier('free');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  const planConfig = getPlanConfig(planTier);

  return {
    planTier,
    planConfig,
    isLoading,
    error,
    refetch: fetchPlan
  };
}



