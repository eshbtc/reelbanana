// Wrapper service that adds usage tracking to Gemini operations
import { generateStory as originalGenerateStory, generateImageSequence as originalGenerateImageSequence, generateCharacter, generateStyle } from './geminiService';
import { OPERATION_COSTS } from '../utils/costCalculator';
import type { CharacterOption } from '../types';

/**
 * Tracked story generation with automatic credit management
 */
export const generateStory = async (topic: string, forceUseApiKey?: boolean) => {
  // For now, we'll use a simple approach without the hook
  // In a real implementation, you'd want to restructure this to use React hooks properly
  
  const { reserveCredits, completeCreditOperation, refundCredits } = await import('./creditService');
  const { getCurrentUser } = await import('./authService');
  
  const user = getCurrentUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const operation = 'storyGeneration';
  const requiredCredits = OPERATION_COSTS[operation];
  
  // Generate idempotency key
  const idempotencyKey = `${user.uid}-${operation}-${Date.now()}-${btoa(topic).slice(0, 8)}`;
  
  try {
    // Reserve credits
    const reserveResult = await reserveCredits(operation, { topic }, { topic, forceUseApiKey });
    if (!reserveResult.success) {
      throw new Error(reserveResult.error || 'Failed to reserve credits');
    }

    // Execute the original function
    const result = await originalGenerateStory(topic, forceUseApiKey);
    
    // Mark as completed
    await completeCreditOperation(reserveResult.idempotencyKey, 'completed');
    
    return result;
  } catch (error) {
    // Mark as failed and refund credits
    await completeCreditOperation(idempotencyKey, 'failed', error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
};

/**
 * Tracked image generation with automatic credit management
 */
export const generateImageSequence = async (
  prompt: string,
  characterRefs: CharacterOption[],
  opts?: {
    location?: string;
    props?: string[];
    costumes?: string[];
    sceneDirection?: string;
  }
) => {
  const { reserveCredits, completeCreditOperation } = await import('./creditService');
  const { getCurrentUser } = await import('./authService');
  
  const user = getCurrentUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const operation = 'imageGeneration';
  const imageCount = 5; // Default number of images
  const requiredCredits = OPERATION_COSTS[operation] * imageCount;
  
  // Generate idempotency key
  const idempotencyKey = `${user.uid}-${operation}-${Date.now()}-${btoa(prompt).slice(0, 8)}`;
  
  try {
    // Reserve credits
    const reserveResult = await reserveCredits(operation, { imageCount }, { prompt, characterRefs, opts });
    if (!reserveResult.success) {
      throw new Error(reserveResult.error || 'Failed to reserve credits');
    }

    // Execute the original function
    const result = await originalGenerateImageSequence(prompt, characterRefs, opts);
    
    // Mark as completed
    await completeCreditOperation(reserveResult.idempotencyKey, 'completed');
    
    return result;
  } catch (error) {
    // Mark as failed and refund credits
    await completeCreditOperation(idempotencyKey, 'failed', error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
};

// Re-export other functions without tracking for now
export { generateCharacter, generateStyle };
