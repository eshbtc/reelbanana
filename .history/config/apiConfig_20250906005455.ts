// API Configuration for ReelBanana Backend Services
// This file contains all the backend service endpoints and configuration

export interface ApiConfig {
  baseUrls: {
    upload: string;
    narrate: string;
    align: string;
    render: string;
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
  },
  firebase: {
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  },
};

// Development configuration (local services)
const DEVELOPMENT_CONFIG: ApiConfig = {
  baseUrls: {
    upload: 'http://localhost:8083',
    narrate: 'http://localhost:8080',
    align: 'http://localhost:8081',
    render: 'http://localhost:8082',
  },
  firebase: {
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  },
};

// AI Studio configuration (for deployment on AI Studio)
const AI_STUDIO_CONFIG: ApiConfig = {
  baseUrls: {
    upload: 'https://reel-banana-upload-assets-423229273041.us-central1.run.app',
    narrate: 'https://reel-banana-narrate-423229273041.us-central1.run.app',
    align: 'https://reel-banana-align-captions-423229273041.us-central1.run.app',
    render: 'https://reel-banana-render-423229273041.us-central1.run.app',
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
};

// Helper function for making API calls
export const apiCall = async (url: string, body: object, errorMessage: string) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ details: 'Could not parse error response.' }));
    throw new Error(`${errorMessage}: ${errorData.details || response.statusText}`);
  }
  
  return response.json();
};
