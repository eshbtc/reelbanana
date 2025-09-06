// API Configuration for ReelBanana Backend Services
// Hybrid approach: Secret Manager for production, env vars for development
// This combines enterprise security with developer-friendly fallbacks
import { getAppCheckToken } from '../lib/appCheck';

export interface ApiConfig {
  baseUrls: {
    upload: string;
    narrate: string;
    align: string;
    render: string;
    compose: string;
    apiKey: string;
  };
  firebase: {
    projectId: string;
    apiKey: string;
    authDomain: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
  };
}

// Production configuration (Google Cloud Run services)
const PRODUCTION_CONFIG: ApiConfig = {
  baseUrls: {
    upload: 'https://reel-banana-upload-assets-423229273041.us-central1.run.app',
    narrate: 'https://reel-banana-narrate-423229273041.us-central1.run.app',
    align: 'https://reel-banana-align-captions-423229273041.us-central1.run.app',
    render: 'https://reel-banana-render-423229273041.us-central1.run.app',
    compose: 'https://reel-banana-compose-music-423229273041.us-central1.run.app',
    apiKey: 'https://reel-banana-api-key-service-423229273041.us-central1.run.app',
  },
  firebase: {
    projectId: 'reel-banana-35a54', // Can be hardcoded - not sensitive
    apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY || 'AIzaSyDummyKeyForAppCheck', // Placeholder for App Check
    authDomain: 'reel-banana-35a54.firebaseapp.com',
    storageBucket: 'reel-banana-35a54.appspot.com',
    messagingSenderId: (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID || '123456789',
    appId: (import.meta as any).env?.VITE_FIREBASE_APP_ID || '1:123456789:web:abcdef123456',
  },
};

// Development configuration (local services)
const DEVELOPMENT_CONFIG: ApiConfig = {
  baseUrls: {
    upload: 'http://localhost:8083',
    narrate: 'http://localhost:8080',
    align: 'http://localhost:8081',
    render: 'http://localhost:8082',
    compose: 'http://localhost:8084',
    apiKey: 'http://localhost:8085',
  },
  firebase: {
    projectId: 'reel-banana-35a54', // Can be hardcoded - not sensitive
    apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY || 'AIzaSyDummyKeyForAppCheck', // Placeholder for App Check
    authDomain: 'reel-banana-35a54.firebaseapp.com',
    storageBucket: 'reel-banana-35a54.appspot.com',
    messagingSenderId: (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID || '123456789',
    appId: (import.meta as any).env?.VITE_FIREBASE_APP_ID || '1:123456789:web:abcdef123456',
  },
};

// AI Studio configuration (for deployment on AI Studio)
const AI_STUDIO_CONFIG: ApiConfig = {
  baseUrls: {
    upload: 'https://reel-banana-upload-assets-423229273041.us-central1.run.app',
    narrate: 'https://reel-banana-narrate-423229273041.us-central1.run.app',
    align: 'https://reel-banana-align-captions-423229273041.us-central1.run.app',
    render: 'https://reel-banana-render-423229273041.us-central1.run.app',
    compose: 'https://reel-banana-compose-music-423229273041.us-central1.run.app',
    apiKey: 'https://reel-banana-api-key-service-423229273041.us-central1.run.app',
  },
  firebase: {
    projectId: 'reel-banana-35a54', // Can be hardcoded - not sensitive
    apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY || 'AIzaSyDummyKeyForAppCheck', // Placeholder for App Check
    authDomain: 'reel-banana-35a54.firebaseapp.com',
    storageBucket: 'reel-banana-35a54.appspot.com',
    messagingSenderId: (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID || '123456789',
    appId: (import.meta as any).env?.VITE_FIREBASE_APP_ID || '1:123456789:web:abcdef123456',
  },
};

// Determine which configuration to use based on environment
const getConfig = (): ApiConfig => {
  const environment = process.env.NODE_ENV || 'development';
  
  switch (environment) {
    case 'production':
      return PRODUCTION_CONFIG;
    case 'ai-studio':
      return AI_STUDIO_CONFIG;
    default:
      return DEVELOPMENT_CONFIG;
  }
};

export const apiConfig = getConfig();

// API endpoint helpers
export const API_ENDPOINTS = {
  upload: `${apiConfig.baseUrls.upload}/upload-image`,
  narrate: `${apiConfig.baseUrls.narrate}/narrate`,
  align: `${apiConfig.baseUrls.align}/align`,
  render: `${apiConfig.baseUrls.render}/render`,
  compose: `${apiConfig.baseUrls.compose}/compose-music`,
  apiKey: {
    store: `${apiConfig.baseUrls.apiKey}/store-api-key`,
    use: `${apiConfig.baseUrls.apiKey}/use-api-key`,
    check: `${apiConfig.baseUrls.apiKey}/check-api-key`,
    remove: `${apiConfig.baseUrls.apiKey}/remove-api-key`,
  },
};


// Helper function for making API calls with improved error handling
export const apiCall = async (url: string, body: object, errorMessage: string) => {
  try {
    // Get App Check token
    const appCheckToken = await getAppCheckToken();
    
    const headers: Record<string, string> = { 
      'Content-Type': 'application/json',
      // Removed CORS header - configure on server side
    };
    
    if (appCheckToken) {
      headers['X-Firebase-AppCheck'] = appCheckToken;
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      let errorData: any = null;
      try { errorData = await response.json(); } catch (_) {}
      const code = errorData?.code || `HTTP_${response.status}`;
      const msg = errorData?.message || response.statusText;
      const reqId = errorData?.requestId ? ` (req: ${errorData.requestId})` : '';
      throw new Error(`${errorMessage} [${code}] ${msg}${reqId}`);
    }
    
    return response.json();
  } catch (error) {
    console.error(`API call failed for ${url}:`, error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`${errorMessage}: Network or parsing error`);
  }
};
