import { useState, useCallback } from 'react';
import { reserveCredits, completeCreditOperation, refundCredits, UsageEvent } from '../services/creditService';
import { OPERATION_COSTS } from '../utils/costCalculator';

interface UseUsageTrackingReturn {
  trackOperation: (
    operation: keyof typeof OPERATION_COSTS,
    params?: any,
    metadata?: any
  ) => Promise<{ success: boolean; idempotencyKey: string; error?: string }>;
  completeOperation: (
    idempotencyKey: string,
    success: boolean,
    error?: string
  ) => Promise<{ success: boolean; error?: string }>;
  isProcessing: boolean;
  error: string | null;
}

/**
 * Hook for tracking usage and managing credit operations
 */
export const useUsageTracking = (): UseUsageTrackingReturn => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trackOperation = useCallback(async (
    operation: keyof typeof OPERATION_COSTS,
    params?: any,
    metadata?: any
  ): Promise<{ success: boolean; idempotencyKey: string; error?: string }> => {
    setIsProcessing(true);
    setError(null);

    try {
      const result = await reserveCredits(operation, params, metadata);
      
      if (!result.success) {
        setError(result.error || 'Failed to reserve credits');
        return result;
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      return {
        success: false,
        idempotencyKey: '',
        error: errorMessage,
      };
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const completeOperation = useCallback(async (
    idempotencyKey: string,
    success: boolean,
    error?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      if (success) {
        return await completeCreditOperation(idempotencyKey, 'completed');
      } else {
        // Refund credits for failed operations
        const refundResult = await refundCredits(idempotencyKey, error || 'Operation failed');
        if (refundResult.success) {
          return await completeCreditOperation(idempotencyKey, 'failed', error);
        }
        return refundResult;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: errorMessage,
      };
    }
  }, []);

  return {
    trackOperation,
    completeOperation,
    isProcessing,
    error,
  };
};

/**
 * Higher-order function to wrap API calls with usage tracking
 */
export const withUsageTracking = <T extends any[], R>(
  operation: keyof typeof OPERATION_COSTS,
  apiCall: (...args: T) => Promise<R>,
  getParams?: (...args: T) => any,
  getMetadata?: (...args: T) => any
) => {
  return async (...args: T): Promise<R> => {
    const { trackOperation, completeOperation } = useUsageTracking();
    
    const params = getParams ? getParams(...args) : undefined;
    const metadata = getMetadata ? getMetadata(...args) : undefined;
    
    // Reserve credits
    const reserveResult = await trackOperation(operation, params, metadata);
    if (!reserveResult.success) {
      throw new Error(reserveResult.error || 'Failed to reserve credits');
    }

    try {
      // Execute the actual API call
      const result = await apiCall(...args);
      
      // Mark operation as completed
      await completeOperation(reserveResult.idempotencyKey, true);
      
      return result;
    } catch (error) {
      // Mark operation as failed and refund credits
      await completeOperation(reserveResult.idempotencyKey, false, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  };
};

/**
 * Hook for tracking specific operations with automatic credit management
 */
export const useOperationTracking = (operation: keyof typeof OPERATION_COSTS) => {
  const { trackOperation, completeOperation, isProcessing, error } = useUsageTracking();

  const executeWithTracking = useCallback(async <T>(
    apiCall: () => Promise<T>,
    params?: any,
    metadata?: any
  ): Promise<T> => {
    // Reserve credits
    const reserveResult = await trackOperation(operation, params, metadata);
    if (!reserveResult.success) {
      throw new Error(reserveResult.error || 'Failed to reserve credits');
    }

    try {
      // Execute the API call
      const result = await apiCall();
      
      // Mark as completed
      await completeOperation(reserveResult.idempotencyKey, true);
      
      return result;
    } catch (error) {
      // Mark as failed and refund
      await completeOperation(reserveResult.idempotencyKey, false, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }, [operation, trackOperation, completeOperation]);

  return {
    executeWithTracking,
    isProcessing,
    error,
  };
};
