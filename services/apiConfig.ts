// services/apiConfig.ts
// Centralized configuration for API keys and endpoints.
// This helps keep secrets out of the source code and makes them configurable via environment variables.

// IMPORTANT: These environment variables must be set in your deployment environment (e.g., AI Studio secrets).
// The placeholder values in firebaseService.ts have been replaced by this secure method.

export const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID
};

// A simple check to ensure the essential configuration is provided during runtime.
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    // This warning will be visible in the developer console if the environment variables are not set.
    console.warn("Firebase configuration is missing or incomplete. Please ensure FIREBASE_API_KEY and FIREBASE_PROJECT_ID are set in your environment.");
}

/**
 * Gemini API Key Configuration
 *
 * Implements a fallback mechanism for the Gemini API key.
 * 1. It prioritizes a custom, user-provided key from the 'REEL_BANANA_GEMINI_API_KEY' environment variable.
 *    This allows users with paid plans to bypass rate limits of the default key.
 * 2. If the custom key is not found, it falls back to the default 'API_KEY' provided by the AI Studio environment.
 * 3. A warning is logged if no API key is found, which is crucial for debugging.
 */
export const geminiApiKey = process.env.REEL_BANANA_GEMINI_API_KEY || process.env.API_KEY;

if (!geminiApiKey) {
    console.error("CRITICAL: No Gemini API Key found. Please set either REEL_BANANA_GEMINI_API_KEY or ensure the standard API_KEY is available in your environment.");
}
