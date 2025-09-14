// Stripe Elements integration service
import { Stripe, StripeElements, StripeCardElement } from '@stripe/stripe-js';
import { getStripeConfig } from './stripeService';

export interface StripeElementsConfig {
  stripe: Stripe | null;
  elements: StripeElements | null;
  publishableKey: string;
}

/**
 * Initialize Stripe Elements with configuration
 */
export const initializeStripeElements = async (): Promise<StripeElementsConfig> => {
  try {
    const config = await getStripeConfig();
    const { loadStripe } = await import('@stripe/stripe-js');
    
    const stripe = await loadStripe(config.publishableKey);
    
    if (!stripe) {
      throw new Error('Failed to load Stripe');
    }

    const { loadStripeElements } = await import('@stripe/react-stripe-js');
    const elements = loadStripeElements(stripe, {
      appearance: {
        theme: 'night',
        variables: {
          colorPrimary: '#f59e0b', // amber-500
          colorBackground: '#1f2937', // gray-800
          colorText: '#ffffff',
          colorDanger: '#ef4444', // red-500
          fontFamily: 'Inter, system-ui, sans-serif',
          spacingUnit: '4px',
          borderRadius: '8px',
        },
        rules: {
          '.Input': {
            backgroundColor: '#374151', // gray-700
            border: '1px solid #4b5563', // gray-600
            color: '#ffffff',
          },
          '.Input:focus': {
            borderColor: '#f59e0b', // amber-500
            boxShadow: '0 0 0 1px #f59e0b',
          },
          '.Label': {
            color: '#d1d5db', // gray-300
            fontWeight: '500',
          },
          '.Error': {
            color: '#ef4444', // red-500
          },
        },
      },
    });

    return {
      stripe,
      elements,
      publishableKey: config.publishableKey,
    };
  } catch (error) {
    console.error('Failed to initialize Stripe Elements:', error);
    throw new Error('Payment system initialization failed');
  }
};

/**
 * Create a payment method from card element
 */
export const createPaymentMethod = async (
  stripe: Stripe,
  cardElement: StripeCardElement
): Promise<{ paymentMethod: any; error: any }> => {
  try {
    const { error, paymentMethod } = await stripe.createPaymentMethod({
      type: 'card',
      card: cardElement,
    });

    return { paymentMethod, error };
  } catch (error) {
    console.error('Failed to create payment method:', error);
    return { paymentMethod: null, error };
  }
};

/**
 * Confirm payment intent
 */
export const confirmPaymentIntent = async (
  stripe: Stripe,
  clientSecret: string
): Promise<{ paymentIntent: any; error: any }> => {
  try {
    const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret);
    return { paymentIntent, error };
  } catch (error) {
    console.error('Failed to confirm payment intent:', error);
    return { paymentIntent: null, error };
  }
};

/**
 * Confirm setup intent (for saving payment methods)
 */
export const confirmSetupIntent = async (
  stripe: Stripe,
  clientSecret: string
): Promise<{ setupIntent: any; error: any }> => {
  try {
    const { error, setupIntent } = await stripe.confirmCardSetup(clientSecret);
    return { setupIntent, error };
  } catch (error) {
    console.error('Failed to confirm setup intent:', error);
    return { setupIntent: null, error };
  }
};

/**
 * Get card element options for consistent styling
 */
export const getCardElementOptions = () => ({
  style: {
    base: {
      fontSize: '16px',
      color: '#ffffff',
      '::placeholder': {
        color: '#9ca3af',
      },
      backgroundColor: '#374151',
      border: '1px solid #4b5563',
      borderRadius: '8px',
      padding: '12px',
    },
    invalid: {
      color: '#ef4444',
      borderColor: '#ef4444',
    },
  },
  hidePostalCode: false,
});

/**
 * Validate card element
 */
export const validateCardElement = (cardElement: StripeCardElement): Promise<{ error: any }> => {
  return new Promise((resolve) => {
    cardElement.on('change', (event) => {
      resolve({ error: event.error });
    });
  });
};

/**
 * Handle Stripe errors with user-friendly messages
 */
export const getStripeErrorMessage = (error: any): string => {
  if (!error) return 'An unknown error occurred';
  
  switch (error.type) {
    case 'card_error':
    case 'validation_error':
      return error.message || 'Invalid card information';
    case 'api_connection_error':
      return 'Network error. Please check your connection and try again.';
    case 'api_error':
      return 'Payment system error. Please try again later.';
    case 'authentication_error':
      return 'Authentication failed. Please refresh and try again.';
    case 'rate_limit_error':
      return 'Too many requests. Please wait a moment and try again.';
    default:
      return error.message || 'Payment failed. Please try again.';
  }
};

/**
 * Check if Stripe is ready
 */
export const isStripeReady = (stripe: Stripe | null): boolean => {
  return stripe !== null;
};

/**
 * Get Stripe publishable key
 */
export const getStripePublishableKey = async (): Promise<string> => {
  try {
    const config = await getStripeConfig();
    return config.publishableKey;
  } catch (error) {
    console.error('Failed to get Stripe publishable key:', error);
    throw new Error('Failed to load payment configuration');
  }
};
