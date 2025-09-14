import { AspectRatioConfig, ExportPresetConfig, AspectRatio, ExportPreset } from '../types';

// Aspect ratio configurations
export const ASPECT_RATIOS: AspectRatioConfig[] = [
  {
    id: '16:9',
    name: 'Widescreen',
    description: 'Perfect for YouTube, presentations, and desktop viewing',
    width: 1920,
    height: 1080,
    icon: '📺'
  },
  {
    id: '9:16',
    name: 'Vertical',
    description: 'Optimized for TikTok, Instagram Stories, and mobile',
    width: 1080,
    height: 1920,
    icon: '📱'
  },
  {
    id: '1:1',
    name: 'Square',
    description: 'Great for Instagram posts and social media',
    width: 1080,
    height: 1080,
    icon: '⬜'
  }
];

// Export presets with platform-specific optimizations
export const EXPORT_PRESETS: ExportPresetConfig[] = [
  {
    id: 'youtube',
    name: 'YouTube',
    description: 'Optimized for YouTube with high quality and wide compatibility',
    platform: 'YouTube',
    aspectRatio: '16:9',
    resolution: { width: 1920, height: 1080 },
    bitrate: '8000k',
    container: 'mp4'
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    description: 'Vertical format optimized for TikTok and Instagram Reels',
    platform: 'TikTok',
    aspectRatio: '9:16',
    resolution: { width: 1080, height: 1920 },
    bitrate: '5000k',
    container: 'mp4'
  },
  {
    id: 'square',
    name: 'Instagram Square',
    description: 'Square format perfect for Instagram posts',
    platform: 'Instagram',
    aspectRatio: '1:1',
    resolution: { width: 1080, height: 1080 },
    bitrate: '4000k',
    container: 'mp4'
  },
  {
    id: 'custom',
    name: 'Custom',
    description: 'Custom resolution and settings',
    platform: 'Custom',
    aspectRatio: '16:9',
    resolution: { width: 1920, height: 1080 },
    bitrate: '6000k',
    container: 'mp4'
  }
];

// Plan-based resolution limits
export const PLAN_RESOLUTION_LIMITS = {
  free: { maxWidth: 854, maxHeight: 480 },
  plus: { maxWidth: 1280, maxHeight: 720 },
  pro: { maxWidth: 1920, maxHeight: 1080 },
  studio: { maxWidth: 3840, maxHeight: 2160 }
} as const;

// Get aspect ratio config by ID
export function getAspectRatioConfig(id: AspectRatio): AspectRatioConfig | undefined {
  return ASPECT_RATIOS.find(ratio => ratio.id === id);
}

// Get export preset config by ID
export function getExportPresetConfig(id: ExportPreset): ExportPresetConfig | undefined {
  return EXPORT_PRESETS.find(preset => preset.id === id);
}

// Get available aspect ratios for a user plan
export function getAvailableAspectRatios(userPlan: keyof typeof PLAN_RESOLUTION_LIMITS): AspectRatioConfig[] {
  const limits = PLAN_RESOLUTION_LIMITS[userPlan];
  
  return ASPECT_RATIOS.filter(ratio => 
    ratio.width <= limits.maxWidth && ratio.height <= limits.maxHeight
  );
}

// Get available export presets for a user plan
export function getAvailableExportPresets(userPlan: keyof typeof PLAN_RESOLUTION_LIMITS): ExportPresetConfig[] {
  const limits = PLAN_RESOLUTION_LIMITS[userPlan];
  
  return EXPORT_PRESETS.filter(preset => 
    preset.resolution.width <= limits.maxWidth && preset.resolution.height <= limits.maxHeight
  );
}

// Check if an aspect ratio is available for a user plan
export function isAspectRatioAvailable(ratio: AspectRatioConfig, userPlan: keyof typeof PLAN_RESOLUTION_LIMITS): boolean {
  const limits = PLAN_RESOLUTION_LIMITS[userPlan];
  return ratio.width <= limits.maxWidth && ratio.height <= limits.maxHeight;
}

// Check if an export preset is available for a user plan
export function isExportPresetAvailable(preset: ExportPresetConfig, userPlan: keyof typeof PLAN_RESOLUTION_LIMITS): boolean {
  const limits = PLAN_RESOLUTION_LIMITS[userPlan];
  return preset.resolution.width <= limits.maxWidth && preset.resolution.height <= limits.maxHeight;
}

// Clamp resolution to plan limits
export function clampResolutionToPlan(
  width: number, 
  height: number, 
  userPlan: keyof typeof PLAN_RESOLUTION_LIMITS
): { width: number; height: number } {
  const limits = PLAN_RESOLUTION_LIMITS[userPlan];
  
  // Maintain aspect ratio while clamping to limits
  const aspectRatio = width / height;
  
  if (width > limits.maxWidth) {
    width = limits.maxWidth;
    height = Math.round(width / aspectRatio);
  }
  
  if (height > limits.maxHeight) {
    height = limits.maxHeight;
    width = Math.round(height * aspectRatio);
  }
  
  return { width, height };
}

