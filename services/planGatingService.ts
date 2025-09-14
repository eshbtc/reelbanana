// Enhanced plan gating service for P1 Monetization
import { PlanTier, getPlanConfig, hasFeature, supportsResolution } from '../lib/planMapper';
import { getSubscriptionStatus } from './stripeService';

export interface PlanGateResult {
  allowed: boolean;
  reason?: string;
  upgradeRequired?: boolean;
  suggestedPlan?: PlanTier;
  currentPlan: PlanTier;
  feature: string;
}

export interface PlanGateOptions {
  feature: string;
  currentState?: {
    sceneCount?: number;
    totalDuration?: number;
    resolution?: { width: number; height: number };
    hasCredits?: boolean;
    dailyRenders?: number;
  };
  bypassAdmin?: boolean;
}

/**
 * Enhanced plan gating with detailed upgrade suggestions
 */
export async function checkPlanGate(options: PlanGateOptions): Promise<PlanGateResult> {
  try {
    const { feature, currentState = {}, bypassAdmin = false } = options;
    
    // Get user's current plan
    const subscriptionStatus = await getSubscriptionStatus();
    const currentPlan = subscriptionStatus.plan as PlanTier;
    const planConfig = getPlanConfig(currentPlan);
    
    // Admin bypass (if enabled)
    if (bypassAdmin && currentPlan === 'studio') {
      return {
        allowed: true,
        currentPlan,
        feature
      };
    }
    
    // Feature-specific gating logic
    switch (feature) {
      case 'high_resolution':
        return checkHighResolutionGate(currentPlan, currentState.resolution);
        
      case 'pro_polish':
        return checkProPolishGate(currentPlan);
        
      case 'scene_limit':
        return checkSceneLimitGate(currentPlan, currentState.sceneCount);
        
      case 'duration_limit':
        return checkDurationLimitGate(currentPlan, currentState.totalDuration);
        
      case 'daily_renders':
        return checkDailyRendersGate(currentPlan, currentState.dailyRenders);
        
      case 'watermark_removal':
        return checkWatermarkRemovalGate(currentPlan);
        
      case 'byo_api_keys':
        return checkBYOApiKeysGate(currentPlan);
        
      case 'custom_branding':
        return checkCustomBrandingGate(currentPlan);
        
      case 'api_access':
        return checkApiAccessGate(currentPlan);
        
      case 'team_seats':
        return checkTeamSeatsGate(currentPlan);
        
      case 'review_links':
        return checkReviewLinksGate(currentPlan);
        
      default:
        return {
          allowed: true,
          currentPlan,
          feature
        };
    }
  } catch (error) {
    console.error('Plan gate check failed:', error);
    return {
      allowed: false,
      reason: 'Unable to verify plan permissions',
      currentPlan: 'free',
      feature: options.feature
    };
  }
}

/**
 * Check high resolution rendering permissions
 */
function checkHighResolutionGate(currentPlan: PlanTier, resolution?: { width: number; height: number }): PlanGateResult {
  const planConfig = getPlanConfig(currentPlan);
  
  if (!resolution) {
    return {
      allowed: currentPlan !== 'free',
      reason: currentPlan === 'free' ? 'High resolution rendering requires Plus plan or higher' : undefined,
      upgradeRequired: currentPlan === 'free',
      suggestedPlan: 'plus',
      currentPlan,
      feature: 'high_resolution'
    };
  }
  
  const supported = supportsResolution(currentPlan, resolution.width, resolution.height);
  
  if (!supported) {
    const suggestedPlan = getSuggestedPlanForResolution(resolution.width, resolution.height);
    return {
      allowed: false,
      reason: `Resolution ${resolution.width}x${resolution.height} requires ${suggestedPlan} plan or higher`,
      upgradeRequired: true,
      suggestedPlan,
      currentPlan,
      feature: 'high_resolution'
    };
  }
  
  return {
    allowed: true,
    currentPlan,
    feature: 'high_resolution'
  };
}

/**
 * Check Pro Polish feature permissions
 */
function checkProPolishGate(currentPlan: PlanTier): PlanGateResult {
  const allowed = hasFeature(currentPlan, 'Pro Polish') || currentPlan === 'pro' || currentPlan === 'studio';
  
  return {
    allowed,
    reason: !allowed ? 'Pro Polish requires Pro plan or higher' : undefined,
    upgradeRequired: !allowed,
    suggestedPlan: 'pro',
    currentPlan,
    feature: 'pro_polish'
  };
}

/**
 * Check scene limit permissions
 */
function checkSceneLimitGate(currentPlan: PlanTier, sceneCount?: number): PlanGateResult {
  const planConfig = getPlanConfig(currentPlan);
  
  if (sceneCount && sceneCount >= planConfig.limits.maxScenes) {
    const suggestedPlan = getSuggestedPlanForScenes(sceneCount);
    return {
      allowed: false,
      reason: `Maximum ${planConfig.limits.maxScenes} scenes allowed. Upgrade to create longer stories.`,
      upgradeRequired: true,
      suggestedPlan,
      currentPlan,
      feature: 'scene_limit'
    };
  }
  
  return {
    allowed: true,
    currentPlan,
    feature: 'scene_limit'
  };
}

/**
 * Check duration limit permissions
 */
function checkDurationLimitGate(currentPlan: PlanTier, totalDuration?: number): PlanGateResult {
  const planConfig = getPlanConfig(currentPlan);
  const maxDuration = getMaxDurationForPlan(currentPlan);
  
  if (totalDuration && totalDuration > maxDuration) {
    const suggestedPlan = getSuggestedPlanForDuration(totalDuration);
    return {
      allowed: false,
      reason: `Maximum ${maxDuration} seconds duration allowed. Upgrade to create longer videos.`,
      upgradeRequired: true,
      suggestedPlan,
      currentPlan,
      feature: 'duration_limit'
    };
  }
  
  return {
    allowed: true,
    currentPlan,
    feature: 'duration_limit'
  };
}

/**
 * Check daily renders limit permissions
 */
function checkDailyRendersGate(currentPlan: PlanTier, dailyRenders?: number): PlanGateResult {
  const planConfig = getPlanConfig(currentPlan);
  
  if (dailyRenders && dailyRenders >= planConfig.limits.dailyRenders) {
    const suggestedPlan = getSuggestedPlanForDailyRenders(dailyRenders);
    return {
      allowed: false,
      reason: `Daily render limit reached (${planConfig.limits.dailyRenders}). Upgrade to increase limits.`,
      upgradeRequired: true,
      suggestedPlan,
      currentPlan,
      feature: 'daily_renders'
    };
  }
  
  return {
    allowed: true,
    currentPlan,
    feature: 'daily_renders'
  };
}

/**
 * Check watermark removal permissions
 */
function checkWatermarkRemovalGate(currentPlan: PlanTier): PlanGateResult {
  const allowed = currentPlan !== 'free';
  
  return {
    allowed,
    reason: !allowed ? 'Watermark removal requires Plus plan or higher' : undefined,
    upgradeRequired: !allowed,
    suggestedPlan: 'plus',
    currentPlan,
    feature: 'watermark_removal'
  };
}

/**
 * Check BYO API keys permissions
 */
function checkBYOApiKeysGate(currentPlan: PlanTier): PlanGateResult {
  const allowed = hasFeature(currentPlan, 'BYO API keys') || currentPlan === 'pro' || currentPlan === 'studio';
  
  return {
    allowed,
    reason: !allowed ? 'Bring Your Own API keys requires Pro plan or higher' : undefined,
    upgradeRequired: !allowed,
    suggestedPlan: 'pro',
    currentPlan,
    feature: 'byo_api_keys'
  };
}

/**
 * Check custom branding permissions
 */
function checkCustomBrandingGate(currentPlan: PlanTier): PlanGateResult {
  const allowed = hasFeature(currentPlan, 'Custom branding') || currentPlan === 'pro' || currentPlan === 'studio';
  
  return {
    allowed,
    reason: !allowed ? 'Custom branding requires Pro plan or higher' : undefined,
    upgradeRequired: !allowed,
    suggestedPlan: 'pro',
    currentPlan,
    feature: 'custom_branding'
  };
}

/**
 * Check API access permissions
 */
function checkApiAccessGate(currentPlan: PlanTier): PlanGateResult {
  const allowed = hasFeature(currentPlan, 'API access') || currentPlan === 'pro' || currentPlan === 'studio';
  
  return {
    allowed,
    reason: !allowed ? 'API access requires Pro plan or higher' : undefined,
    upgradeRequired: !allowed,
    suggestedPlan: 'pro',
    currentPlan,
    feature: 'api_access'
  };
}

/**
 * Check team seats permissions
 */
function checkTeamSeatsGate(currentPlan: PlanTier): PlanGateResult {
  const allowed = hasFeature(currentPlan, 'Team seats') || currentPlan === 'studio';
  
  return {
    allowed,
    reason: !allowed ? 'Team seats require Studio plan' : undefined,
    upgradeRequired: !allowed,
    suggestedPlan: 'studio',
    currentPlan,
    feature: 'team_seats'
  };
}

// Helper functions for plan suggestions
function getSuggestedPlanForResolution(width: number, height: number): PlanTier {
  if (width <= 1280 && height <= 720) return 'plus';
  if (width <= 1920 && height <= 1080) return 'pro';
  return 'studio';
}

function getSuggestedPlanForScenes(sceneCount: number): PlanTier {
  if (sceneCount <= 8) return 'plus';
  if (sceneCount <= 15) return 'pro';
  return 'studio';
}

function getSuggestedPlanForDuration(duration: number): PlanTier {
  if (duration <= 30) return 'plus';
  if (duration <= 60) return 'pro';
  return 'studio';
}

function getSuggestedPlanForDailyRenders(renders: number): PlanTier {
  if (renders <= 50) return 'plus';
  if (renders <= 200) return 'pro';
  return 'studio';
}

function getMaxDurationForPlan(plan: PlanTier): number {
  const durations = {
    free: 15,
    plus: 30,
    pro: 60,
    studio: 300
  };
  return durations[plan] || durations.free;
}


/**
 * Check review links permissions
 */
function checkReviewLinksGate(currentPlan: PlanTier): PlanGateResult {
  if (currentPlan === 'free' || currentPlan === 'plus') {
    return {
      allowed: false,
      reason: 'Review links require Pro plan or higher',
      upgradeRequired: true,
      suggestedPlan: 'pro',
      currentPlan,
      feature: 'review_links'
    };
  }
  
  return {
    allowed: true,
    currentPlan,
    feature: 'review_links'
  };
}
