// Stripe service for subscription management
import { API_ENDPOINTS, apiCall } from '../config/apiConfig';
import { authFetch } from '../lib/authFetch';

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  interval: 'month' | 'year';
  priceId?: string | null;
  features: string[];
  limits: {
    dailyRenders: number;
    maxScenes: number;
    resolution: string;
  };
}

export interface StripeConfig {
  publishableKey: string;
  plans: SubscriptionPlan[];
}

export interface SubscriptionStatus {
  subscription: {
    id: string;
    status: string;
    planId: string;
    currentPeriodEnd: Date;
  } | null;
  freeCredits: number;
  plan: string;
}

// Load Stripe.js dynamically
let stripePromise: Promise<any> | null = null;

const loadStripe = async (publishableKey: string) => {
  if (!stripePromise) {
    stripePromise = import('@stripe/stripe-js').then(({ loadStripe }) => 
      loadStripe(publishableKey)
    );
  }
  return stripePromise;
};

/**
 * Get Stripe configuration and available plans
 */
export const getStripeConfig = async (): Promise<StripeConfig> => {
  try {
    // Check if user is authenticated first
    const { getCurrentUser } = await import('./authService');
    const user = getCurrentUser();
    if (!user) {
      throw new Error('User must be authenticated to access billing information');
    }

    const response = await authFetch(API_ENDPOINTS.stripe.config, {
      method: 'GET'
    });
    
    if (!response.ok) {
      throw new Error('Failed to get Stripe configuration');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error getting Stripe config:', error);
    throw new Error('Failed to load subscription plans');
  }
};

/**
 * Create a Stripe customer
 */
export const createStripeCustomer = async (email?: string, name?: string): Promise<string> => {
  try {
    const response = await authFetch(API_ENDPOINTS.stripe.createCustomer, {
      method: 'POST',
      body: { email, name }
    });
    
    if (!response.ok) {
      throw new Error('Failed to create customer');
    }
    
    const data = await response.json();
    return data.customerId;
  } catch (error) {
    console.error('Error creating Stripe customer:', error);
    throw new Error('Failed to create customer account');
  }
};

/**
 * Create a subscription
 */
export const createSubscription = async (
  priceId: string, 
  paymentMethodId: string
): Promise<{ subscriptionId: string; clientSecret: string }> => {
  try {
    const response = await authFetch(API_ENDPOINTS.stripe.createSubscription, {
      method: 'POST',
      body: { priceId, paymentMethodId }
    });
    
    if (!response.ok) {
      throw new Error('Failed to create subscription');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error creating subscription:', error);
    throw new Error('Failed to create subscription');
  }
};

/**
 * Get user's subscription status
 */
export const getSubscriptionStatus = async (): Promise<SubscriptionStatus> => {
  try {
    const response = await authFetch(API_ENDPOINTS.stripe.subscriptionStatus, {
      method: 'GET'
    });
    
    if (!response.ok) {
      throw new Error('Failed to get subscription status');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error getting subscription status:', error);
    throw new Error('Failed to load subscription status');
  }
};

/**
 * Initialize Stripe and create payment method
 */
export const initializeStripePaymentWithInstance = async (
  stripe: any,
  cardElement: any
): Promise<{ paymentMethod: any; error: any }> => {
  try {
    if (!stripe) throw new Error('Stripe not initialized');
    const { error, paymentMethod } = await stripe.createPaymentMethod({ type: 'card', card: cardElement });
    return { paymentMethod, error };
  } catch (error) {
    console.error('Error creating payment method:', error);
    return { paymentMethod: null, error };
  }
};

// Backward-compatible wrapper (may cause instance mismatch if Elements came from a different instance)
export const initializeStripePayment = async (
  publishableKey: string,
  _elements: any,
  cardElement: any
): Promise<{ paymentMethod: any; error: any }> => {
  const stripe = await loadStripe(publishableKey);
  return initializeStripePaymentWithInstance(stripe, cardElement);
};

/**
 * Confirm payment for subscription
 */
export const confirmSubscriptionPaymentWithInstance = async (
  stripe: any,
  clientSecret: string
): Promise<{ subscription: any; error: any }> => {
  try {
    if (!stripe) throw new Error('Stripe not initialized');
    const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret);
    // Normalize to { subscription } shape for callers expecting it
    return { subscription: paymentIntent, error } as any;
  } catch (error) {
    console.error('Error confirming payment:', error);
    return { subscription: null, error } as any;
  }
};

// Backward-compatible wrapper
export const confirmSubscriptionPayment = async (
  publishableKey: string,
  clientSecret: string
): Promise<{ subscription: any; error: any }> => {
  const stripe = await loadStripe(publishableKey);
  return confirmSubscriptionPaymentWithInstance(stripe, clientSecret);
};

/**
 * Get plan limits for current user
 */
export const getPlanLimits = async (): Promise<{
  dailyRenders: number;
  maxScenes: number;
  resolution: string;
  plan: string;
}> => {
  try {
    const status = await getSubscriptionStatus();
    const config = await getStripeConfig();
    
    const plan = config.plans.find(p => p.id === status.plan) || config.plans[0];
    
    return {
      dailyRenders: plan.limits.dailyRenders,
      maxScenes: plan.limits.maxScenes,
      resolution: plan.limits.resolution,
      plan: status.plan
    };
  } catch (error) {
    console.error('Error getting plan limits:', error);
    // Return free plan limits as fallback
    return {
      dailyRenders: 5,
      maxScenes: 3,
      resolution: '480p',
      plan: 'free'
    };
  }
};

/**
 * Check if user can perform an action based on their plan
 */
export const canPerformAction = async (
  action: 'render' | 'scene' | 'resolution',
  currentUsage?: { dailyRenders?: number; sceneCount?: number }
): Promise<{ allowed: boolean; reason?: string }> => {
  try {
    const limits = await getPlanLimits();
    
    switch (action) {
      case 'render':
        if (currentUsage?.dailyRenders && currentUsage.dailyRenders >= limits.dailyRenders) {
          return {
            allowed: false,
            reason: `Daily render limit reached (${limits.dailyRenders}). Upgrade to increase limits.`
          };
        }
        break;
        
      case 'scene':
        if (currentUsage?.sceneCount && currentUsage.sceneCount >= limits.maxScenes) {
          return {
            allowed: false,
            reason: `Scene limit reached (${limits.maxScenes}). Upgrade to create longer stories.`
          };
        }
        break;
        
      case 'resolution':
        if (limits.resolution === '480p') {
          return {
            allowed: false,
            reason: 'High resolution rendering requires Plus plan or higher.'
          };
        }
        break;
    }
    
    return { allowed: true };
  } catch (error) {
    console.error('Error checking action permissions:', error);
    return { allowed: false, reason: 'Unable to verify permissions' };
  }
};
