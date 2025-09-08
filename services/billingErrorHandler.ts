// Comprehensive error handling for billing operations
export interface BillingError {
  code: string;
  message: string;
  userMessage: string;
  recoverable: boolean;
  action?: 'retry' | 'purchase_credits' | 'contact_support' | 'refresh';
  metadata?: any;
}

export interface ErrorContext {
  operation: string;
  userId?: string;
  amount?: number;
  timestamp: Date;
  metadata?: any;
}

/**
 * Billing error codes and their handling
 */
export const BILLING_ERRORS: Record<string, BillingError> = {
  // Credit-related errors
  INSUFFICIENT_CREDITS: {
    code: 'INSUFFICIENT_CREDITS',
    message: 'User does not have enough credits for this operation',
    userMessage: 'You don\'t have enough credits. Purchase more credits to continue.',
    recoverable: true,
    action: 'purchase_credits',
  },
  
  CREDIT_RESERVATION_FAILED: {
    code: 'CREDIT_RESERVATION_FAILED',
    message: 'Failed to reserve credits for operation',
    userMessage: 'Unable to reserve credits. Please try again or contact support.',
    recoverable: true,
    action: 'retry',
  },
  
  CREDIT_REFUND_FAILED: {
    code: 'CREDIT_REFUND_FAILED',
    message: 'Failed to refund credits for failed operation',
    userMessage: 'Operation failed but we couldn\'t refund your credits. Contact support for assistance.',
    recoverable: false,
    action: 'contact_support',
  },
  
  // Payment-related errors
  PAYMENT_FAILED: {
    code: 'PAYMENT_FAILED',
    message: 'Payment processing failed',
    userMessage: 'Payment could not be processed. Please check your payment method and try again.',
    recoverable: true,
    action: 'retry',
  },
  
  PAYMENT_DECLINED: {
    code: 'PAYMENT_DECLINED',
    message: 'Payment was declined by the bank',
    userMessage: 'Your payment was declined. Please check your card details or try a different payment method.',
    recoverable: true,
    action: 'retry',
  },
  
  PAYMENT_INSUFFICIENT_FUNDS: {
    code: 'PAYMENT_INSUFFICIENT_FUNDS',
    message: 'Insufficient funds in the payment method',
    userMessage: 'Your payment method has insufficient funds. Please add funds or use a different payment method.',
    recoverable: true,
    action: 'retry',
  },
  
  // Stripe-specific errors
  STRIPE_CARD_ERROR: {
    code: 'STRIPE_CARD_ERROR',
    message: 'Stripe card processing error',
    userMessage: 'There was an issue with your card. Please check your card details and try again.',
    recoverable: true,
    action: 'retry',
  },
  
  STRIPE_RATE_LIMIT: {
    code: 'STRIPE_RATE_LIMIT',
    message: 'Stripe API rate limit exceeded',
    userMessage: 'Too many requests. Please wait a moment and try again.',
    recoverable: true,
    action: 'retry',
  },
  
  STRIPE_AUTHENTICATION_ERROR: {
    code: 'STRIPE_AUTHENTICATION_ERROR',
    message: 'Stripe authentication failed',
    userMessage: 'Payment service authentication failed. Please contact support.',
    recoverable: false,
    action: 'contact_support',
  },
  
  // Network and system errors
  NETWORK_ERROR: {
    code: 'NETWORK_ERROR',
    message: 'Network connection error',
    userMessage: 'Network error. Please check your connection and try again.',
    recoverable: true,
    action: 'retry',
  },
  
  TIMEOUT_ERROR: {
    code: 'TIMEOUT_ERROR',
    message: 'Operation timed out',
    userMessage: 'The operation took too long. Please try again.',
    recoverable: true,
    action: 'retry',
  },
  
  SERVICE_UNAVAILABLE: {
    code: 'SERVICE_UNAVAILABLE',
    message: 'Billing service is temporarily unavailable',
    userMessage: 'Our billing service is temporarily unavailable. Please try again in a few minutes.',
    recoverable: true,
    action: 'retry',
  },
  
  // Database and storage errors
  DATABASE_ERROR: {
    code: 'DATABASE_ERROR',
    message: 'Database operation failed',
    userMessage: 'Unable to process your request. Please try again or contact support.',
    recoverable: true,
    action: 'retry',
  },
  
  TRANSACTION_CONFLICT: {
    code: 'TRANSACTION_CONFLICT',
    message: 'Transaction conflict detected',
    userMessage: 'Another operation is in progress. Please wait and try again.',
    recoverable: true,
    action: 'retry',
  },
  
  // Validation errors
  INVALID_AMOUNT: {
    code: 'INVALID_AMOUNT',
    message: 'Invalid credit amount specified',
    userMessage: 'Invalid amount. Please refresh the page and try again.',
    recoverable: true,
    action: 'refresh',
  },
  
  INVALID_USER: {
    code: 'INVALID_USER',
    message: 'Invalid or unauthenticated user',
    userMessage: 'Please sign in to continue.',
    recoverable: true,
    action: 'refresh',
  },
  
  // Generic fallback
  UNKNOWN_ERROR: {
    code: 'UNKNOWN_ERROR',
    message: 'An unknown error occurred',
    userMessage: 'Something went wrong. Please try again or contact support if the problem persists.',
    recoverable: true,
    action: 'retry',
  },
};

/**
 * Parse error and return appropriate billing error
 */
export const parseBillingError = (error: any, context?: ErrorContext): BillingError => {
  // Handle different error types
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    // Check for specific error patterns
    if (message.includes('insufficient') && message.includes('credit')) {
      return BILLING_ERRORS.INSUFFICIENT_CREDITS;
    }
    
    if (message.includes('payment') && message.includes('declined')) {
      return BILLING_ERRORS.PAYMENT_DECLINED;
    }
    
    if (message.includes('insufficient') && message.includes('fund')) {
      return BILLING_ERRORS.PAYMENT_INSUFFICIENT_FUNDS;
    }
    
    if (message.includes('network') || message.includes('connection')) {
      return BILLING_ERRORS.NETWORK_ERROR;
    }
    
    if (message.includes('timeout')) {
      return BILLING_ERRORS.TIMEOUT_ERROR;
    }
    
    if (message.includes('rate limit')) {
      return BILLING_ERRORS.STRIPE_RATE_LIMIT;
    }
    
    if (message.includes('card')) {
      return BILLING_ERRORS.STRIPE_CARD_ERROR;
    }
    
    if (message.includes('authentication') || message.includes('unauthorized')) {
      return BILLING_ERRORS.STRIPE_AUTHENTICATION_ERROR;
    }
    
    if (message.includes('database') || message.includes('firestore')) {
      return BILLING_ERRORS.DATABASE_ERROR;
    }
    
    if (message.includes('conflict')) {
      return BILLING_ERRORS.TRANSACTION_CONFLICT;
    }
  }
  
  // Handle error objects with codes
  if (error && typeof error === 'object') {
    if (error.code && BILLING_ERRORS[error.code]) {
      return BILLING_ERRORS[error.code];
    }
    
    if (error.type === 'card_error') {
      return BILLING_ERRORS.STRIPE_CARD_ERROR;
    }
    
    if (error.type === 'rate_limit_error') {
      return BILLING_ERRORS.STRIPE_RATE_LIMIT;
    }
    
    if (error.type === 'authentication_error') {
      return BILLING_ERRORS.STRIPE_AUTHENTICATION_ERROR;
    }
  }
  
  // Default to unknown error
  return BILLING_ERRORS.UNKNOWN_ERROR;
};

/**
 * Log billing error for monitoring and debugging
 */
export const logBillingError = (error: BillingError, context?: ErrorContext) => {
  const logData = {
    error: error.code,
    message: error.message,
    userMessage: error.userMessage,
    recoverable: error.recoverable,
    action: error.action,
    context,
    timestamp: new Date().toISOString(),
  };
  
  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Billing Error:', logData);
  }
  
  // In production, you would send this to your logging service
  // Example: sendToLoggingService(logData);
};

/**
 * Handle billing error with appropriate user feedback
 */
export const handleBillingError = (
  error: any,
  context?: ErrorContext
): { billingError: BillingError; shouldRetry: boolean; userAction: string } => {
  const billingError = parseBillingError(error, context);
  
  // Log the error
  logBillingError(billingError, context);
  
  // Determine if we should retry
  const shouldRetry = billingError.recoverable && billingError.action === 'retry';
  
  // Get user action message
  const userAction = billingError.userMessage;
  
  return {
    billingError,
    shouldRetry,
    userAction,
  };
};

/**
 * Retry mechanism for recoverable errors
 */
export const retryOperation = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> => {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      const { shouldRetry } = handleBillingError(error);
      
      if (!shouldRetry || attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retrying with exponential backoff
      const delay = delayMs * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
};

/**
 * Get user-friendly error message for display
 */
export const getUserErrorMessage = (error: any): string => {
  const { userAction } = handleBillingError(error);
  return userAction;
};

/**
 * Check if error is recoverable
 */
export const isRecoverableError = (error: any): boolean => {
  const { shouldRetry } = handleBillingError(error);
  return shouldRetry;
};
