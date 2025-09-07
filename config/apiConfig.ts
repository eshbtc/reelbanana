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
    projectId: 'reel-banana-35a54', // Not sensitive
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
    projectId: 'reel-banana-35a54',
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
    projectId: 'reel-banana-35a54',
    apiKey: 'AIzaSyCeZNdwsaZ_sBmOt8WY0FcUziq22-OVJjg',
    authDomain: 'reel-banana-35a54.firebaseapp.com',
    storageBucket: 'reel-banana-35a54.firebasestorage.app',
    messagingSenderId: '223097908182',
    appId: '1:223097908182:web:982c634d6aaeb3c805d277',
  },
};

// Runtime configuration validation
const validateConfig = (config: ApiConfig, envName: string): void => {
  const errors: string[] = [];
  
  // Validate base URLs
  Object.entries(config.baseUrls).forEach(([service, url]) => {
    if (!url || typeof url !== 'string') {
      errors.push(`Invalid ${service} URL: ${url}`);
    } else if (!url.startsWith('http')) {
      errors.push(`${service} URL must start with http/https: ${url}`);
    }
  });
  
  // Validate Firebase config
  const { firebase } = config;
  if (!firebase.projectId || !firebase.apiKey || !firebase.authDomain) {
    errors.push('Missing required Firebase configuration fields');
  }
  
  if (!firebase.storageBucket.endsWith('.firebasestorage.app')) {
    errors.push(`Storage bucket should end with .firebasestorage.app: ${firebase.storageBucket}`);
  }
  
  if (errors.length > 0) {
    console.error(`❌ Configuration validation failed for ${envName}:`, errors);
    throw new Error(`Invalid configuration for ${envName}: ${errors.join(', ')}`);
  }
  
  console.log(`✅ Configuration validated for ${envName}`);
};

// Determine which configuration to use based on environment
// Environment Selection Logic:
// 1. PRODUCTION: Built with Vite (import.meta.env.PROD = true) → uses 223097908182 services
// 2. AI_STUDIO: Set VITE_TARGET_ENV=ai-studio → uses 423229273041 services  
// 3. DEVELOPMENT: localhost/127.0.0.1 → uses local services (ports 8080-8086)
// 4. FALLBACK: Any other case → defaults to PRODUCTION (223097908182)
const getConfig = (): ApiConfig => {
  let selectedConfig: ApiConfig;
  let envName: string;
  
  // Production builds (Firebase Hosting, etc.)
  if (import.meta.env.PROD) {
    selectedConfig = PRODUCTION_CONFIG;
    envName = 'PRODUCTION';
  }
  // Explicit AI Studio target via env flag
  else if ((import.meta as any)?.env?.VITE_TARGET_ENV === 'ai-studio') {
    selectedConfig = AI_STUDIO_CONFIG;
    envName = 'AI_STUDIO';
  }
  // Local development: localhost/127.0.0.1
  else if (typeof window !== 'undefined' && 
           (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    selectedConfig = DEVELOPMENT_CONFIG;
    envName = 'DEVELOPMENT';
  }
  // Fallback to production
  else {
    selectedConfig = PRODUCTION_CONFIG;
    envName = 'PRODUCTION (fallback)';
  }
  
  // Log environment selection
  console.log(`🔧 API Config: Using ${envName} environment`);
  console.log(`📡 Base URLs:`, selectedConfig.baseUrls);
  console.log(`🔥 Firebase Project: ${selectedConfig.firebase.projectId}`);
  
  // Validate configuration at runtime
  try {
    validateConfig(selectedConfig, envName);
  } catch (error) {
    console.error('Configuration validation failed:', error);
    // In production, we might want to throw, but for development, log and continue
    if (import.meta.env.PROD) {
      throw error;
    }
  }
  
  return selectedConfig;
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
  playbackTracking: `${apiConfig.baseUrls.render}/playback-tracking`,
  sliDashboard: `${apiConfig.baseUrls.render}/sli-dashboard`,
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
    // Debug logging for upload requests
    if (url.includes('/upload-image')) {
      const bodyData = body as any;
      console.log('🔍 apiCall debug for upload:', {
        url,
        projectId: bodyData.projectId,
        fileName: bodyData.fileName,
        hasBase64Image: !!bodyData.base64Image,
        isValidDataUri: bodyData.base64Image?.startsWith('data:image/'),
        base64Preview: bodyData.base64Image?.substring(0, 50),
        expectedBucket: 'oneminute-movie-in (default bucket for upload service)'
      });
    }

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
      const full = `${errorMessage} [${code}] ${msg}${reqId}`;
      try { (window as any)?.rbToast?.({ type: 'error', message: full, duration: 5000 }); } catch {}
      throw new Error(full);
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
