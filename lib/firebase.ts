// Centralized Firebase initialization with App Check
import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { apiConfig } from '../config/apiConfig';
import { initializeFirestore } from 'firebase/firestore';

// Set debug token for development BEFORE initializing App Check
if (import.meta.env.DEV) {
  // @ts-ignore - Set global debug token for development
  (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = import.meta.env.VITE_APP_CHECK_DEBUG_TOKEN || '0F5620AB-13C3-4881-8BF2-1C9F89C0372B';
}

// Initialize Firebase app once
export const firebaseApp = initializeApp(apiConfig.firebase);

// Initialize App Check for security and abuse prevention
export const appCheck = initializeAppCheck(firebaseApp, {
  provider: new ReCaptchaV3Provider('6LfSNMArAAAAALXUYNGFmOSJN7O7W9c4Chp4oP1e'), // Your reCAPTCHA v3 site key
  isTokenAutoRefreshEnabled: true
});

// Firestore networking fallback for restrictive networks/ad blockers
// - Auto-detect long polling by default
// - Allow forcing long polling via env (useful to avoid WebChannel TYPE=terminate noise)
const forceLongPolling = (import.meta.env.VITE_FIRESTORE_FORCE_LONG_POLLING || '').toString() === 'true';
initializeFirestore(firebaseApp, {
  experimentalAutoDetectLongPolling: true,
  experimentalForceLongPolling: forceLongPolling,
  // When forcing long polling, disable fetch streams for maximum compatibility
  // (kept enabled otherwise to preserve performance)
  useFetchStreams: !forceLongPolling,
});

// Export the app for use in other files
export default firebaseApp;
