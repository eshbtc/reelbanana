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
    polish: string;
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
    upload: 'https://reel-banana-upload-assets-223097908182.us-central1.run.app',
    narrate: 'https://reel-banana-narrate-223097908182.us-central1.run.app',
    align: 'https://reel-banana-align-captions-223097908182.us-central1.run.app',
    render: 'https://reel-banana-render-223097908182.us-central1.run.app',
    compose: 'https://reel-banana-compose-music-223097908182.us-central1.run.app',
    polish: 'https://reel-banana-polish-223097908182.us-central1.run.app',
    apiKey: 'https://reel-banana-api-key-service-223097908182.us-central1.run.app',
  },
  firebase: {
    projectId: 'reel-banana-35a54', // Can be hardcoded - not sensitive
    apiKey: 'AIzaSyCeZNdwsaZ_sBmOt8WY0FcUziq22-OVJjg',
    authDomain: 'reel-banana-35a54.firebaseapp.com',
    storageBucket: 'reel-banana-35a54.firebasestorage.app',
    messagingSenderId: '223097908182',
    appId: '1:223097908182:web:982c634d6aaeb3c805d277',
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
    polish: 'http://localhost:8086',
    apiKey: 'http://localhost:8085',
  },
  firebase: {
    projectId: 'reel-banana-35a54', // Can be hardcoded - not sensitive
    apiKey: 'AIzaSyCeZNdwsaZ_sBmOt8WY0FcUziq22-OVJjg',
    authDomain: 'reel-banana-35a54.firebaseapp.com',
    storageBucket: 'reel-banana-35a54.firebasestorage.app',
    messagingSenderId: '223097908182',
    appId: '1:223097908182:web:982c634d6aaeb3c805d277',
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
    polish: 'https://reel-banana-polish-423229273041.us-central1.run.app',
    apiKey: 'https://reel-banana-api-key-service-423229273041.us-central1.run.app',
  },
  firebase: {
    projectId: 'reel-banana-35a54', // Can be hardcoded - not sensitive
    apiKey: 'AIzaSyCeZNdwsaZ_sBmOt8WY0FcUziq22-OVJjg',
    authDomain: 'reel-banana-35a54.firebaseapp.com',
    storageBucket: 'reel-banana-35a54.firebasestorage.app',
    messagingSenderId: '223097908182',
    appId: '1:223097908182:web:982c634d6aaeb3c805d277',
  },
};

// Determine which configuration to use based on environment
const getConfig = (): ApiConfig => {
  // In production (Firebase Hosting), always use production config
  if (import.meta.env.PROD) {
    return PRODUCTION_CONFIG;
  }
  
  // For development, check if we're on the live domain
  if (typeof window !== 'undefined' && window.location.hostname === 'reelbanana.ai') {
    return PRODUCTION_CONFIG;
  }
  
  // Default to production config for deployed environments
  return PRODUCTION_CONFIG;
};

export const apiConfig = getConfig();

// API endpoint helpers
export const API_ENDPOINTS = {
  upload: `${apiConfig.baseUrls.upload}/upload-image`,
  narrate: `${apiConfig.baseUrls.narrate}/narrate`,
  align: `${apiConfig.baseUrls.align}/align`,
  render: `${apiConfig.baseUrls.render}/render`,
  compose: `${apiConfig.baseUrls.compose}/compose-music`,
  polish: `${apiConfig.baseUrls.polish}/polish`,
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
    // Attach Firebase ID token if available (for BYO keys / plan gating)
    try {
      const { getAuth } = await import('firebase/auth');
      const { firebaseApp } = await import('../lib/firebase');
      const auth = getAuth(firebaseApp as any);
      const currentUser = auth.currentUser;
      if (currentUser) {
        const idToken = await currentUser.getIdToken();
        headers['Authorization'] = `Bearer ${idToken}`;
      }
    } catch (_) {
      // Non-fatal: proceed without Authorization header
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
