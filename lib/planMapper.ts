// Plan mapping utilities for Stripe integration
export type PlanTier = 'free' | 'plus' | 'pro' | 'studio';

export interface PlanInfo {
  tier: PlanTier;
  name: string;
  price: number;
  features: string[];
  limits: {
    dailyRenders: number;
    maxScenes: number;
    resolution: string;
    maxWidth: number;
    maxHeight: number;
  };
}

// Map Stripe price IDs to plan tiers
export const PRICE_ID_TO_TIER: Record<string, PlanTier> = {
  'price_plus': 'plus',
  'price_pro': 'pro', 
  'price_studio': 'studio',
  // Free plan has no price ID
};

// Map plan tiers to Stripe price IDs (reverse mapping)
export const TIER_TO_PRICE_ID: Record<PlanTier, string | null> = {
  'free': null,
  'plus': 'price_plus',
  'pro': 'price_pro',
  'studio': 'price_studio',
};

// Plan configurations
export const PLAN_CONFIGS: Record<PlanTier, PlanInfo> = {
  free: {
    tier: 'free',
    name: 'Free',
    price: 0,
    features: [
      '50 free credits',
      '480p render',
      'Basic templates',
      'Watermark'
    ],
    limits: {
      dailyRenders: 5,
      maxScenes: 3,
      resolution: '480p',
      maxWidth: 854,
      maxHeight: 480
    }
  },
  plus: {
    tier: 'plus',
    name: 'Plus',
    price: 9,
    features: [
      '500 credits/month',
      '720p render',
      'All templates',
      'No watermark',
      'Priority support'
    ],
    limits: {
      dailyRenders: 50,
      maxScenes: 8,
      resolution: '720p',
      maxWidth: 1280,
      maxHeight: 720
    }
  },
  pro: {
    tier: 'pro',
    name: 'Pro',
    price: 29,
    features: [
      '2000 credits/month',
      '1080p render',
      'Pro Polish',
      'Custom branding',
      'Review links',
      'API access',
      'BYO API keys'
    ],
    limits: {
      dailyRenders: 200,
      maxScenes: 15,
      resolution: '1080p',
      maxWidth: 1920,
      maxHeight: 1080
    }
  },
  studio: {
    tier: 'studio',
    name: 'Studio',
    price: 99,
    features: [
      '10000 credits/month',
      '4K render',
      'Team seats',
      'Review links',
      'Full API access',
      'White-label solution',
      'Custom integrations',
      'Dedicated support',
      'SLA guarantee'
    ],
    limits: {
      dailyRenders: 1000,
      maxScenes: 50,
      resolution: '4K',
      maxWidth: 3840,
      maxHeight: 2160
    }
  }
};

/**
 * Map Stripe plan ID to plan tier
 */
export function mapPlanIdToTier(planId: string | null | undefined): PlanTier {
  if (!planId || planId === 'free') {
    return 'free';
  }
  
  return PRICE_ID_TO_TIER[planId] || 'free';
}

/**
 * Get plan configuration by tier
 */
export function getPlanConfig(tier: PlanTier): PlanInfo {
  return PLAN_CONFIGS[tier];
}

/**
 * Get plan configuration by Stripe plan ID
 */
export function getPlanConfigById(planId: string | null | undefined): PlanInfo {
  const tier = mapPlanIdToTier(planId);
  return getPlanConfig(tier);
}

/**
 * Check if a plan tier has a specific feature
 */
export function hasFeature(tier: PlanTier, feature: string): boolean {
  const config = getPlanConfig(tier);
  return config.features.some(f => f.toLowerCase().includes(feature.toLowerCase()));
}

/**
 * Check if a plan tier supports a resolution
 */
export function supportsResolution(tier: PlanTier, width: number, height: number): boolean {
  const config = getPlanConfig(tier);
  return width <= config.limits.maxWidth && height <= config.limits.maxHeight;
}

/**
 * Get the highest resolution supported by a plan
 */
export function getMaxResolution(tier: PlanTier): { width: number; height: number } {
  const config = getPlanConfig(tier);
  return {
    width: config.limits.maxWidth,
    height: config.limits.maxHeight
  };
}
