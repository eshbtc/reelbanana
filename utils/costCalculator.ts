// Cost calculation utilities for ReelBanana
import { Scene } from '../types';

// Token pricing rates (per 1M tokens)
export const PRICING_RATES = {
  'gemini-2.5-flash': 0.000075, // $0.075 per 1M tokens
  'gemini-2.5-flash-image-preview': 0.000075, // Same rate for image generation
};

// Helper function to calculate estimated cost based on tokens and model
export const calculateCost = (totalTokens: number, model: string): number => {
  const rate = PRICING_RATES[model as keyof typeof PRICING_RATES] || 0.000075;
  return (totalTokens / 1000000) * rate;
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

// Calculate cost for a single scene
export const calculateSceneCost = (scene: Scene, frames: number = 5): {
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

// Calculate total cost for multiple scenes
export const calculateTotalCost = (scenes: Scene[]): {
  total: number;
  perScene: Array<{ sceneIndex: number; cost: number }>;
  breakdown: {
    imageGeneration: number;
    narration: number;
  };
} => {
  let totalImageCost = 0;
  let totalNarrationCost = 0;
  const perScene: Array<{ sceneIndex: number; cost: number }> = [];
  
  scenes.forEach((scene, index) => {
    const sceneCost = calculateSceneCost(scene);
    totalImageCost += sceneCost.imageGeneration;
    totalNarrationCost += sceneCost.narration;
    perScene.push({ sceneIndex: index, cost: sceneCost.total });
  });
  
  return {
    total: totalImageCost + totalNarrationCost,
    perScene,
    breakdown: {
      imageGeneration: totalImageCost,
      narration: totalNarrationCost,
    }
  };
};

// Format cost for display
export const formatCost = (cost: number): string => {
  if (cost < 0.001) {
    return '< $0.001';
  }
  return `$${cost.toFixed(3)}`;
};

// Get cost tier information
export const getCostTier = (cost: number): {
  tier: 'low' | 'medium' | 'high';
  color: string;
  description: string;
} => {
  if (cost < 0.01) {
    return {
      tier: 'low',
      color: 'text-green-400',
      description: 'Very Low Cost'
    };
  } else if (cost < 0.05) {
    return {
      tier: 'medium',
      color: 'text-yellow-400',
      description: 'Low Cost'
    };
  } else {
    return {
      tier: 'high',
      color: 'text-red-400',
      description: 'Higher Cost'
    };
  }
};
