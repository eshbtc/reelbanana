import React, { useEffect, useState } from 'react';
import { loadStripe, Stripe, StripeElements, StripeElementsOptions } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { getStripeConfig } from '../services/stripeService';

interface StripeElementsWrapperProps {
  children: React.ReactNode;
  clientSecret?: string;
  appearance?: StripeElementsOptions['appearance'];
}

const StripeElementsWrapper: React.FC<StripeElementsWrapperProps> = ({
  children,
  clientSecret,
  appearance
}) => {
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeStripe = async () => {
      try {
        const config = await getStripeConfig();
        const stripe = loadStripe(config.publishableKey);
        setStripePromise(stripe);
      } catch (err) {
        console.error('Failed to initialize Stripe:', err);
        setError('Failed to load payment system');
      } finally {
        setIsLoading(false);
      }
    };

    initializeStripe();
  }, []);

  const defaultAppearance: StripeElementsOptions['appearance'] = {
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
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
        <span className="ml-3 text-gray-300">Loading payment system...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500 text-red-300 p-4 rounded-lg">
        <p className="font-medium">Payment System Error</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  if (!stripePromise) {
    return (
      <div className="bg-gray-800 border border-gray-700 text-gray-300 p-4 rounded-lg">
        <p>Payment system not available</p>
      </div>
    );
  }

  const options: StripeElementsOptions = {
    clientSecret,
    appearance: appearance || defaultAppearance,
    loader: 'auto',
  };

  return (
    <Elements stripe={stripePromise} options={options}>
      {children}
    </Elements>
  );
};

export default StripeElementsWrapper;
