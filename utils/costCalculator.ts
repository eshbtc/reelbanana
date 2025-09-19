// Cost calculation utilities for ReelBanana
import { Scene } from '../types';

// Real API costs (per unit) - Updated January 2025
export const REAL_API_COSTS = {
  // Google Gemini 2.5 Flash pricing
  geminiText: 0.00015, // $0.15 per 1M input tokens
  geminiImage: 0.039, // $0.039 per generated image (1290 tokens @ $30/1M)

  // ElevenLabs pricing
  elevenLabsTTS: 0.00005, // $0.05 per 1000 characters ($50/1M chars)
  elevenLabsMusic: 0.50, // $0.50 per minute of music

  // FAL AI pricing
  falVeo3VideoPerSecond: 0.10, // $0.10 per second (no audio)
  falVeo3VideoPerSecondAudio: 0.15, // $0.15 per second (with audio)
  falLtxVideoPerSecond: 0.005, // $0.005 per second (~$0.04 per 8s video)
  falUpscale: 0.10, // $0.10 per upscale (polish)

  // Other processing
  ffmpeg: 0.002, // $0.002 per video compose
  speechToText: 0.01, // Google Speech-to-Text for captions
};

// Credit system configuration
export const CREDIT_CONFIG = {
  creditValue: 0.08, // $0.08 per credit
  markupMultiplier: 3, // 3x markup on API costs
};

// Token pricing rates (per 1M tokens) - legacy support
export const PRICING_RATES = {
  'gemini-2.5-flash': REAL_API_COSTS.geminiText,
  'gemini-2.5-flash-image-preview': REAL_API_COSTS.geminiImage,
};

// Helper function to calculate estimated cost based on tokens and model
export const calculateCost = (totalTokens: number, model: string): number => {
  const rate = PRICING_RATES[model as keyof typeof PRICING_RATES] || 0.000075;
  return (totalTokens / 1000000) * rate;
};

// Convert API cost to credits (with markup)
export const apiCostToCredits = (cost: number): number => {
  return Math.ceil((cost / CREDIT_CONFIG.creditValue) * CREDIT_CONFIG.markupMultiplier);
};

// Convert credits to dollar value
export const creditsToDollars = (credits: number): number => {
  return credits * CREDIT_CONFIG.creditValue;
};

// Operation cost calculations (in credits)
export const OPERATION_COSTS = {
  storyGeneration: 2, // Gemini text generation
  imageGeneration: 3, // Gemini image generation per image
  narration: 1, // ElevenLabs TTS per 100 characters
  videoRendering: 5, // FFmpeg processing
  proPolish: 10, // FAL AI upscaling
  musicGeneration: 2, // Music composition
};

// Estimate tokens for text generation (rough approximation)
const estimateTextTokens = (text: string): number => {
  // Rough estimation: ~4 characters per token for English text
  return Math.ceil(text.length / 4);
};

// Estimate tokens for image generation
export const ESTIMATED_TOKENS_PER_IMAGE = 1000;
export const estimateImageTokens = (imageCount: number): number => {
  // Rough estimate: 1000 tokens per image for generation
  return imageCount * ESTIMATED_TOKENS_PER_IMAGE;
};

// Calculate cost for a single scene (using real API costs in dollars)
export const calculateSceneCost = (scene: Scene, frames: number = 5, videoDuration: number = 8): {
  imageGeneration: number;
  narration: number;
  videoRendering: number;
  proPolish: number;
  total: number;
  breakdown: {
    imageGeneration: { frames: number; cost: number };
    narration: { characters: number; cost: number };
    videoRendering: { seconds: number; cost: number };
    proPolish: { enabled: boolean; cost: number };
  };
} => {
  // Image generation cost (Gemini 2.5 Flash)
  // Each scene typically generates 3-5 images
  const imageCost = REAL_API_COSTS.geminiImage * frames;

  // Narration cost (ElevenLabs TTS)
  const narrationChars = scene.narration ? scene.narration.length : 0;
  const narrationCost = (narrationChars / 1000) * (REAL_API_COSTS.elevenLabsTTS * 1000);

  // Video rendering cost (FAL - per second)
  // Default 8 seconds per scene
  // Use LTX for standard quality (96% cheaper) or Veo3 for premium
  const usesPremium = scene.quality === 'premium' || scene.modelOverride?.includes('veo3');
  const videoRate = usesPremium ?
    REAL_API_COSTS.falVeo3VideoPerSecondAudio :
    REAL_API_COSTS.falLtxVideoPerSecond;
  const videoCost = videoRate * videoDuration;

  // Pro polish cost (FAL upscaling) - optional
  const polishCost = REAL_API_COSTS.falUpscale;

  const totalCost = imageCost + narrationCost + videoCost;

  return {
    imageGeneration: imageCost,
    narration: narrationCost,
    videoRendering: videoCost,
    proPolish: 0, // Disabled by default due to high cost
    total: totalCost,
    breakdown: {
      imageGeneration: { frames, cost: imageCost },
      narration: { characters: narrationChars, cost: narrationCost },
      videoRendering: { seconds: videoDuration, cost: videoCost },
      proPolish: { enabled: false, cost: 0 },
    }
  };
};

// Calculate cost for a single scene (legacy - in dollars)
export const calculateSceneCostLegacy = (scene: Scene, frames: number = 5): {
  imageGeneration: number;
  narration: number;
  total: number;
  breakdown: {
    imageGeneration: { tokens: number; cost: number };
    narration: { tokens: number; cost: number };
  };
} => {
  // Estimate image generation cost
  const imageTokens = estimateImageTokens(frames);
  const imageCost = calculateCost(imageTokens, 'gemini-2.5-flash-image-preview');
  
  // Estimate narration cost (if narration exists)
  const narrationTokens = scene.narration ? estimateTextTokens(scene.narration) : 0;
  const narrationCost = calculateCost(narrationTokens, 'gemini-2.5-flash');
  
  const total = imageCost + narrationCost;
  
  return {
    imageGeneration: imageCost,
    narration: narrationCost,
    total,
    breakdown: {
      imageGeneration: { tokens: imageTokens, cost: imageCost },
      narration: { tokens: narrationTokens, cost: narrationCost },
    }
  };
};

// Calculate total cost for multiple scenes (in credits)
export const calculateTotalCost = (scenes: Scene[]): {
  total: number;
  perScene: Array<{ sceneIndex: number; cost: number }>;
  breakdown: {
    imageGeneration: number;
    narration: number;
    videoRendering: number;
    proPolish: number;
  };
} => {
  let totalImageCost = 0;
  let totalNarrationCost = 0;
  let totalVideoCost = 0;
  let totalPolishCost = 0;
  const perScene: Array<{ sceneIndex: number; cost: number }> = [];
  
  scenes.forEach((scene, index) => {
    const sceneCost = calculateSceneCost(scene);
    totalImageCost += sceneCost.imageGeneration;
    totalNarrationCost += sceneCost.narration;
    totalVideoCost += sceneCost.videoRendering;
    totalPolishCost += sceneCost.proPolish;
    perScene.push({ sceneIndex: index, cost: sceneCost.total });
  });
  
  return {
    total: totalImageCost + totalNarrationCost + totalVideoCost + totalPolishCost,
    perScene,
    breakdown: {
      imageGeneration: totalImageCost,
      narration: totalNarrationCost,
      videoRendering: totalVideoCost,
      proPolish: totalPolishCost,
    }
  };
};

// Credit packages with pricing
export const CREDIT_PACKAGES = [
  {
    id: 'starter',
    name: 'Starter Pack',
    credits: 100,
    price: 10,
    pricePerCredit: 0.10,
    description: 'Perfect for trying out ReelBanana',
    popular: false,
  },
  {
    id: 'creator',
    name: 'Creator Pack',
    credits: 500,
    price: 40,
    pricePerCredit: 0.08,
    description: 'Great for regular content creators',
    popular: true,
  },
  {
    id: 'pro',
    name: 'Pro Pack',
    credits: 1000,
    price: 70,
    pricePerCredit: 0.07,
    description: 'Best value for professional creators',
    popular: false,
  },
  {
    id: 'studio',
    name: 'Studio Pack',
    credits: 5000,
    price: 300,
    pricePerCredit: 0.06,
    description: 'For agencies and studios',
    popular: false,
  },
];

// Free tier configuration
export const FREE_TIER_CONFIG = {
  monthlyCredits: 50,
  maxScenes: 3,
  maxDuration: 30, // seconds
  resolution: '480p',
  watermarked: true,
  features: ['Basic templates', 'Standard voices', '480p output'],
};

// Get video model cost per second
export const getVideoModelCost = (modelId: string): number => {
  if (modelId.includes('ltx') || modelId.includes('ltxv')) {
    return REAL_API_COSTS.falLtxVideoPerSecond;
  } else if (modelId.includes('veo3')) {
    return REAL_API_COSTS.falVeo3VideoPerSecondAudio;
  }
  // Default to LTX pricing for unknown models
  return REAL_API_COSTS.falLtxVideoPerSecond;
};

// Format cost for display
export const formatCost = (cost: number): string => {
  if (cost < 0.001) {
    return '< $0.001';
  }
  return `$${cost.toFixed(3)}`;
};

// Format credits for display
export const formatCredits = (credits: number): string => {
  if (credits < 1) {
    return '< 1 credit';
  }
  return `${credits} credit${credits !== 1 ? 's' : ''}`;
};

// Format price for display
export const formatPrice = (price: number): string => {
  return `$${price.toFixed(2)}`;
};

// Get cost tier information (for credits)
export const getCostTier = (credits: number): {
  tier: 'low' | 'medium' | 'high';
  color: string;
  description: string;
} => {
  if (credits < 10) {
    return {
      tier: 'low',
      color: 'text-green-400',
      description: 'Low Cost'
    };
  } else if (credits < 50) {
    return {
      tier: 'medium',
      color: 'text-yellow-400',
      description: 'Medium Cost'
    };
  } else {
    return {
      tier: 'high',
      color: 'text-red-400',
      description: 'High Cost'
    };
  }
};

// Validate if user has enough credits for operation
export const validateCredits = (userCredits: number, requiredCredits: number, isAdmin: boolean = false): {
  valid: boolean;
  reason?: string;
  remaining?: number;
} => {
  if (isAdmin) {
    return { valid: true, remaining: userCredits };
  }
  
  if (userCredits < requiredCredits) {
    return {
      valid: false,
      reason: `Insufficient credits. You need ${requiredCredits} credits but only have ${userCredits}.`,
      remaining: userCredits
    };
  }
  
  return {
    valid: true,
    remaining: userCredits - requiredCredits
  };
};

// Calculate operation cost based on type
export const getOperationCost = (operation: keyof typeof OPERATION_COSTS, params?: any): number => {
  const baseCost = OPERATION_COSTS[operation];
  
  switch (operation) {
    case 'imageGeneration':
      return baseCost * (params?.imageCount || 1);
    case 'narration':
      const charCount = params?.text?.length || 0;
      return Math.ceil(charCount / 100) * baseCost;
    default:
      return baseCost;
  }
};
