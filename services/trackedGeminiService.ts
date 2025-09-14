// Wrapper service that adds usage tracking to Gemini operations
import {
  generateStory as originalGenerateStory,
  generateImageSequence as originalGenerateImageSequence,
  generateCharacterAndStyle,
} from './geminiService';
import { OPERATION_COSTS } from '../utils/costCalculator';

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
  characterAndStyle: string,
  opts?: {
    characterRefs?: string[];
    backgroundImage?: string;
    frames?: number;
    projectId?: string;
    forceUseApiKey?: boolean;
    sceneIndex?: number;
    onInfo?: (info: { cached?: boolean; retrying?: number }) => void;
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
  const imageCount = Math.min(Math.max(opts?.frames || 5, 1), 5);
  const requiredCredits = OPERATION_COSTS[operation] * imageCount;
  
  // Generate idempotency key
  const idempotencyKey = `${user.uid}-${operation}-${Date.now()}-${btoa(prompt).slice(0, 8)}`;
  
  try {
    // Reserve credits
    const reserveResult = await reserveCredits(operation, { imageCount }, { prompt, characterAndStyle, opts });
    if (!reserveResult.success) {
      throw new Error(reserveResult.error || 'Failed to reserve credits');
    }

    // Execute with simple retry (up to 2 retries)
    let lastError: any = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const result = await originalGenerateImageSequence(prompt, characterAndStyle, opts);
        // Mark as completed
        await completeCreditOperation(reserveResult.idempotencyKey, 'completed');
        return result;
      } catch (err) {
        lastError = err;
        if (attempt < 3) {
          try { opts?.onInfo?.({ retrying: attempt }); } catch {}
          // Backoff: 600ms, then 1200ms
          const delay = 600 * Math.pow(2, attempt - 1);
          await new Promise(res => setTimeout(res, delay));
          continue;
        }
      }
    }
    
    // If we reach here, all attempts failed
    await completeCreditOperation(idempotencyKey, 'failed', lastError instanceof Error ? lastError.message : 'Unknown error');
    throw lastError || new Error('Image generation failed after retries');
  } catch (error) {
    // Mark as failed and refund credits
    await completeCreditOperation(idempotencyKey, 'failed', error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
};

// Re-export character/style generation with same name as in base service
export { generateCharacterAndStyle };
