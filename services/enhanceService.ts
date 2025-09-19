// Enhance Service - Video-to-video transformations and effects
import { API_ENDPOINTS } from '../config/apiConfig';
import { authFetch } from '../lib/authFetch';
import { getCurrentUser } from './authService';
import { getAppCheckToken } from '../lib/appCheck';

// Enhancement presets available
export type EnhancePreset =
  | 'style-cinematic'
  | 'style-anime'
  | 'style-cartoon'
  | 'enhance-quality'
  | 'enhance-face'
  | 'remove-background'
  | 'stabilize';

// Enhancement operations
export type EnhanceOperation =
  | 'style'
  | 'enhance'
  | 'stabilize'
  | 'face'
  | 'background';

// Enhancement request
export interface EnhanceRequest {
  videoUrl?: string;
  gsUrl?: string;
  preset?: EnhancePreset;
  operations?: EnhanceOperation[];
  callbackUrl?: string;
  projectId?: string;
}

// Enhancement response
export interface EnhanceResponse {
  jobId: string;
  status: 'processing' | 'completed' | 'error';
  message: string;
  progressUrl?: string;
  enhancedUrl?: string;
}

// Progress update
export interface EnhanceProgress {
  jobId: string;
  progress: number;
  stage: 'initializing' | 'uploading' | 'analyzing' | 'enhancing' | 'saving' | 'completed' | 'error';
  message: string;
  etaSeconds?: number;
  done?: boolean;
  error?: boolean;
  enhancedUrl?: string;
}

// Preset configurations with descriptions
export const ENHANCE_PRESETS = {
  'style-cinematic': {
    name: 'Cinematic',
    description: 'Apply cinematic color grading and mood',
    icon: '🎬',
    category: 'style'
  },
  'style-anime': {
    name: 'Anime',
    description: 'Transform to anime/manga style',
    icon: '🎌',
    category: 'style'
  },
  'style-cartoon': {
    name: 'Cartoon',
    description: 'Convert to cartoon animation style',
    icon: '🎨',
    category: 'style'
  },
  'enhance-quality': {
    name: 'Upscale HD',
    description: 'Enhance resolution and clarity',
    icon: '📺',
    category: 'quality'
  },
  'enhance-face': {
    name: 'Face Enhancement',
    description: 'Improve facial details and clarity',
    icon: '👤',
    category: 'quality'
  },
  'remove-background': {
    name: 'Remove Background',
    description: 'Remove or replace video background',
    icon: '🎭',
    category: 'effect'
  },
  'stabilize': {
    name: 'Stabilize',
    description: 'Fix shaky footage',
    icon: '🎯',
    category: 'effect'
  }
} as const;

/**
 * Enhance a video with AI transformations
 */
export async function enhanceVideo(request: EnhanceRequest): Promise<EnhanceResponse> {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    throw new Error('Please sign in to enhance videos');
  }

  const appCheckToken = await getAppCheckToken();
  const idToken = await currentUser.getIdToken();

  const response = await fetch(API_ENDPOINTS.enhance.enhanceVideo, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
      'X-Firebase-AppCheck': appCheckToken || '',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Enhancement failed' }));
    throw new Error(error.message || 'Failed to enhance video');
  }

  return response.json();
}

/**
 * Subscribe to enhancement progress via Server-Sent Events
 */
export function subscribeToEnhanceProgress(
  jobId: string,
  onProgress: (progress: EnhanceProgress) => void,
  onError?: (error: Error) => void
): () => void {
  const eventSource = new EventSource(`${API_ENDPOINTS.enhance.progressStream}?jobId=${jobId}`);

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as EnhanceProgress;
      onProgress(data);

      // Close connection if done
      if (data.done || data.error) {
        eventSource.close();
      }
    } catch (error) {
      console.error('Failed to parse progress update:', error);
    }
  };

  eventSource.onerror = (error) => {
    console.error('SSE connection error:', error);
    if (onError) {
      onError(new Error('Connection to enhancement service lost'));
    }
    eventSource.close();
  };

  // Return cleanup function
  return () => {
    eventSource.close();
  };
}

/**
 * Get the status of an enhancement job
 */
export async function getEnhanceJobStatus(jobId: string): Promise<EnhanceProgress> {
  const response = await fetch(`${API_ENDPOINTS.enhance.jobStatus}/${jobId}`);

  if (!response.ok) {
    throw new Error('Failed to get job status');
  }

  return response.json();
}

/**
 * Get recommended presets based on video content
 */
export function getRecommendedPresets(videoUrl?: string): EnhancePreset[] {
  // In the future, this could analyze the video and recommend presets
  // For now, return popular presets
  return ['style-cinematic', 'enhance-quality', 'stabilize'];
}

/**
 * Estimate credits required for enhancement
 */
export function estimateEnhanceCredits(operations: EnhanceOperation[]): number {
  // Each enhancement operation costs 8 credits
  return operations.length * 8;
}

/**
 * Check if user has sufficient credits for enhancement
 */
export async function canUserEnhance(operations: EnhanceOperation[]): Promise<boolean> {
  const requiredCredits = estimateEnhanceCredits(operations);

  // Import checkUserCredits from authService
  const { checkUserCredits } = await import('./authService');
  const currentUser = getCurrentUser();

  if (!currentUser) return false;

  return checkUserCredits(currentUser.uid, requiredCredits);
}

/**
 * Helper to create a quick enhance request for common use cases
 */
export function createQuickEnhance(
  videoUrl: string,
  projectId: string,
  type: 'cinematic' | 'anime' | 'upscale' | 'stabilize'
): EnhanceRequest {
  const presetMap: Record<string, EnhancePreset> = {
    cinematic: 'style-cinematic',
    anime: 'style-anime',
    upscale: 'enhance-quality',
    stabilize: 'stabilize'
  };

  return {
    videoUrl,
    projectId,
    preset: presetMap[type]
  };
}