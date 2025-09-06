// Centralized Firebase initialization
import { initializeApp } from 'firebase/app';
import { apiConfig } from '../config/apiConfig';

// Initialize Firebase app once
export const firebaseApp = initializeApp(apiConfig.firebase);

// Export the app for use in other files
export default firebaseApp;
