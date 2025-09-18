// Plan mapping utilities for backend services
// This mirrors the frontend planMapper.ts for consistency

const PRICE_ID_TO_TIER = {
  'price_plus': 'plus',
  'price_pro': 'pro', 
  'price_studio': 'studio',
  // Free plan has no price ID
};

const PLAN_CONFIGS = {
  free: {
    tier: 'free',
    name: 'Free',
    price: 0,
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
function mapPlanIdToTier(planId) {
  if (!planId || planId === 'free') {
    return 'free';
  }
  
  return PRICE_ID_TO_TIER[planId] || 'free';
}

/**
 * Get plan configuration by tier
 */
function getPlanConfig(tier) {
  return PLAN_CONFIGS[tier] || PLAN_CONFIGS.free;
}

/**
 * Get plan configuration by Stripe plan ID
 */
function getPlanConfigById(planId) {
  const tier = mapPlanIdToTier(planId);
  return getPlanConfig(tier);
}

/**
 * Check if a plan tier supports a resolution
 */
function supportsResolution(tier, width, height) {
  const config = getPlanConfig(tier);
  return width <= config.limits.maxWidth && height <= config.limits.maxHeight;
}

/**
 * Get the highest resolution supported by a plan
 */
function getMaxResolution(tier) {
  const config = getPlanConfig(tier);
  return {
    width: config.limits.maxWidth,
    height: config.limits.maxHeight
  };
}

module.exports = {
  mapPlanIdToTier,
  getPlanConfig,
  getPlanConfigById,
  supportsResolution,
  getMaxResolution,
  PLAN_CONFIGS
};




