// Centralized Firebase initialization with App Check
import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { apiConfig } from '../config/apiConfig';

// Set debug token for development BEFORE initializing App Check
if (import.meta.env.DEV) {
  // @ts-ignore - Set global debug token for development
  (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = 'A767DE56-7486-4A78-8073-0156488A5007';
}

// Initialize Firebase app once
export const firebaseApp = initializeApp(apiConfig.firebase);

// Initialize App Check for security and abuse prevention
export const appCheck = initializeAppCheck(firebaseApp, {
  provider: new ReCaptchaV3Provider('6LfSNMArAAAAALXUYNGFmOSJN7O7W9c4Chp4oP1e'), // Your reCAPTCHA v3 site key
  isTokenAutoRefreshEnabled: true
});

// Export the app for use in other files
export default firebaseApp;
