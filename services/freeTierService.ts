// Free tier limitations and validation service
import { FREE_TIER_CONFIG } from '../utils/costCalculator';
import { useUserCredits } from '../hooks/useUserCredits';

export interface FreeTierLimitations {
  maxScenes: number;
  maxDuration: number; // seconds
  resolution: string;
  watermarked: boolean;
  features: string[];
  monthlyCredits: number;
}

export interface FreeTierValidation {
  canCreateProject: boolean;
  canAddScene: boolean;
  canUseHighResolution: boolean;
  canRemoveWatermark: boolean;
  canUseProFeatures: boolean;
  limitations: string[];
}

/**
 * Get free tier limitations for a user
 */
export const getFreeTierLimitations = (isAdmin: boolean = false): FreeTierLimitations => {
  if (isAdmin) {
    // Admins get unlimited access
    return {
      maxScenes: 999,
      maxDuration: 3600, // 1 hour
      resolution: '4K',
      watermarked: false,
      features: ['All features', 'Unlimited scenes', '4K resolution', 'No watermarks'],
      monthlyCredits: 999999,
    };
  }

  return FREE_TIER_CONFIG;
};

/**
 * Validate if user can perform an action based on free tier limitations
 */
export const validateFreeTierAction = (
  action: 'createProject' | 'addScene' | 'useHighResolution' | 'removeWatermark' | 'useProFeatures',
  currentState: {
    sceneCount?: number;
    totalDuration?: number;
    hasCredits?: boolean;
  },
  isAdmin: boolean = false
): FreeTierValidation => {
  const limitations = getFreeTierLimitations(isAdmin);
  const limitationsList: string[] = [];

  // Check scene count
  if (action === 'addScene' && currentState.sceneCount && currentState.sceneCount >= limitations.maxScenes) {
    limitationsList.push(`Maximum ${limitations.maxScenes} scenes allowed`);
  }

  // Check duration
  if (action === 'createProject' && currentState.totalDuration && currentState.totalDuration > limitations.maxDuration) {
    limitationsList.push(`Maximum ${limitations.maxDuration} seconds duration allowed`);
  }

  // Check credits
  if (!currentState.hasCredits && !isAdmin) {
    limitationsList.push('Insufficient credits');
  }

  return {
    canCreateProject: limitationsList.length === 0 && (currentState.hasCredits || isAdmin),
    canAddScene: currentState.sceneCount ? currentState.sceneCount < limitations.maxScenes : true,
    canUseHighResolution: limitations.resolution !== '480p',
    canRemoveWatermark: !limitations.watermarked,
    canUseProFeatures: isAdmin || limitations.features.includes('All features'),
    limitations: limitationsList,
  };
};

/**
 * Get watermark overlay for free tier users
 */
export const getWatermarkOverlay = (): string => {
  return `
    <div style="
      position: absolute;
      bottom: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.7);
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-family: Arial, sans-serif;
      z-index: 1000;
    ">
      Created with ReelBanana
    </div>
  `;
};

/**
 * Apply free tier limitations to video output
 */
export const applyFreeTierLimitations = (
  videoUrl: string,
  isAdmin: boolean = false,
  hasCredits: boolean = false
): string => {
  const limitations = getFreeTierLimitations(isAdmin);
  
  // If user has credits or is admin, return original URL
  if (hasCredits || isAdmin) {
    return videoUrl;
  }

  // For free tier users, we would apply watermarks and resolution limits
  // This is a placeholder - in a real implementation, you'd modify the video
  // or return a different URL that points to the watermarked version
  
  if (limitations.watermarked) {
    // In a real implementation, you'd:
    // 1. Create a watermarked version of the video
    // 2. Store it separately
    // 3. Return the watermarked URL
    console.log('Applying watermark to video for free tier user');
  }

  if (limitations.resolution === '480p') {
    // In a real implementation, you'd:
    // 1. Downscale the video to 480p
    // 2. Store the downscaled version
    // 3. Return the downscaled URL
    console.log('Downscaling video to 480p for free tier user');
  }

  return videoUrl;
};

/**
 * Get upgrade message for free tier limitations
 */
export const getUpgradeMessage = (limitation: string): string => {
  const messages: Record<string, string> = {
    'scene_limit': 'Upgrade to create longer stories with more scenes',
    'duration_limit': 'Upgrade to create longer videos',
    'resolution_limit': 'Upgrade to export in high resolution (1080p, 4K)',
    'watermark_limit': 'Upgrade to remove watermarks from your videos',
    'credits_limit': 'Purchase credits to continue creating videos',
  };

  return messages[limitation] || 'Upgrade to unlock this feature';
};

/**
 * Check if user needs to upgrade for a specific feature
 */
export const needsUpgrade = (
  feature: 'scenes' | 'duration' | 'resolution' | 'watermark' | 'credits',
  currentState: any,
  isAdmin: boolean = false
): boolean => {
  if (isAdmin) return false;

  const limitations = getFreeTierLimitations();
  
  switch (feature) {
    case 'scenes':
      return currentState.sceneCount >= limitations.maxScenes;
    case 'duration':
      return currentState.totalDuration > limitations.maxDuration;
    case 'resolution':
      return limitations.resolution === '480p';
    case 'watermark':
      return limitations.watermarked;
    case 'credits':
      return !currentState.hasCredits;
    default:
      return false;
  }
};
