// Secure AI service: Firebase AI Logic (free credits) + Encrypted API keys (unlimited)
import { getAI, getGenerativeModel, VertexAIBackend, ResponseModality } from 'firebase/ai';
import { getFirestore, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { firebaseApp } from '../lib/firebase';
import type { CharacterOption } from '../types';
import { getCurrentUser, getUserProfile, recordUsage, checkUserCredits, hasUserApiKey, TokenUsage } from './authService';
import { API_ENDPOINTS } from '../config/apiConfig';
import { authFetch } from '../lib/authFetch';
import { getAppCheckToken } from '../lib/appCheck';

// Use centralized Firebase app
const db = getFirestore(firebaseApp);

// Initialize Firebase AI Logic with Vertex AI backend (global for nano-bana/gemini-2.5-flash-image-preview)
const ai = getAI(firebaseApp, { backend: new VertexAIBackend('global') });

// Helper function to extract token usage from API responses
const extractTokenUsage = (response: any, model: string): TokenUsage | null => {
  try {
    // Firebase AI Logic response format
    if (response.usageMetadata) {
      const usage = response.usageMetadata;
      return {
        promptTokens: usage.promptTokenCount || 0,
        completionTokens: usage.candidatesTokenCount || 0,
        totalTokens: usage.totalTokenCount || 0,
        estimatedCost: calculateCost(usage.totalTokenCount || 0, model),
        model: model
      };
    }
    
    // Custom API response format (from our backend)
    if (response.usage) {
      const usage = response.usage;
      return {
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0,
        estimatedCost: calculateCost(usage.total_tokens || 0, model),
        model: model
      };
    }
    
    return null;
  } catch (error) {
    console.warn('Failed to extract token usage:', error);
    return null;
  }
};

// Helper function to calculate estimated cost based on tokens and model
const calculateCost = (totalTokens: number, model: string): number => {
  // Gemini 2.5 Flash pricing (approximate rates as of 2024)
  const rates: { [key: string]: number } = {
    'gemini-2.5-flash': 0.000075, // $0.075 per 1M tokens
    'gemini-2.5-flash-image-preview': 0.000075, // Same rate for image preview
  };
  
  const rate = rates[model] || 0.000075; // Default rate
  return (totalTokens / 1000000) * rate;
};

// Helper function to determine which AI service to use
const getAIService = async (forceUseApiKey?: boolean): Promise<'firebase' | 'custom' | null> => {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    console.log('🔍 getAIService: No current user');
    return null;
  }

  const userProfile = await getUserProfile(currentUser.uid);
  if (!userProfile) {
    console.log('🔍 getAIService: No user profile found');
    return null;
  }

  // If user explicitly wants to use their API key, skip credit check
  if (forceUseApiKey) {
    console.log('🔑 getAIService: User forced API key usage, checking for stored keys...');
    // Check if user has API key stored server-side (check both Google and FAL keys)
    const hasGoogleApiKey = await hasUserApiKey(currentUser.uid, 'google');
    const hasFalApiKey = await hasUserApiKey(currentUser.uid, 'fal');
    const hasApiKey = hasGoogleApiKey || hasFalApiKey;
    
    if (hasApiKey) {
      console.log('✅ getAIService: Using custom API key (forced by user)');
      return 'custom';
    } else {
      console.log('❌ getAIService: User forced API key but none found - cannot use Firebase AI Logic with customer keys');
      throw new Error('No API key configured. Please add your Gemini API key in the Dashboard to use BYOK mode.');
    }
  }

  // Check if user has any free credits remaining
  const hasCredits = await checkUserCredits(currentUser.uid, 1);
  console.log(`🔍 getAIService: User ${currentUser.uid} has credits: ${hasCredits}`);
  
  if (hasCredits && !forceUseApiKey) {
    console.log('✅ getAIService: Using Firebase AI Logic (free credits)');
    return 'firebase'; // Use Firebase AI Logic with free credits
    // Note: Specific credit amount will be checked later in generateImageSequence after cache miss
  }

  // Check if user has API key stored server-side (check both Google and FAL keys)
  const hasGoogleApiKey = await hasUserApiKey(currentUser.uid, 'google');
  const hasFalApiKey = await hasUserApiKey(currentUser.uid, 'fal');
  const hasApiKey = hasGoogleApiKey || hasFalApiKey;
  
  console.log(`🔍 getAIService: User ${currentUser.uid} has Google API key: ${hasGoogleApiKey}`);
  console.log(`🔍 getAIService: User ${currentUser.uid} has FAL API key: ${hasFalApiKey}`);
  console.log(`🔍 getAIService: User ${currentUser.uid} has any API key: ${hasApiKey}`);
  
  if (hasApiKey) {
    console.log('✅ getAIService: Using custom API key (unlimited usage)');
    return 'custom'; // Use custom API key for unlimited usage
  }

  console.log('❌ getAIService: No credits and no API key available');
  return null; // No credits and no API key
};

// Cache collection name
const CACHE_COLLECTION = 'generated_images_cache';

// Simple hash function for cache keys (includes refs/background signals)
const generateCacheKey = (
  prompt: string,
  characterAndStyle: string,
  opts?: { characterRefs?: string[]; backgroundImage?: string }
): string => {
  const refsSig = (opts?.characterRefs || []).map((s) => s.length).join(',');
  const bgSig = opts?.backgroundImage ? `bg:${opts.backgroundImage.length}` : 'bg:none';
  const combined = `${characterAndStyle}|||${prompt}|||${refsSig}|||${bgSig}`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `cache_${Math.abs(hash).toString(36)}`;
};

const storyResponseSchema = {
    type: "object",
    properties: {
        scenes: {
            type: "array",
            description: "An array of 4-8 scenes for the storyboard.",
            items: {
                type: "object",
                properties: {
                    prompt: {
                        type: "string",
                        description: "A detailed, visually rich prompt for an image generation model. Describe the scene, characters, setting, and mood in a single paragraph. Should be in English. Example: 'A cute, fluffy banana character, with big googly eyes and a cheerful smile, is surfing on a giant wave of milk. The sun is shining brightly in a clear blue sky, and other breakfast cereal characters are cheering from the shore.'",
                    },
                    narration: {
                        type: "string",
                        description: "A short narration for this scene, to be read by a voiceover artist. Around 1-2 sentences. Keep it concise and engaging.",
                    },
                },
                required: ["prompt", "narration"],
            },
        },
    },
    required: ["scenes"],
};

type StoryScene = {
    prompt: string;
    narration: string;
}

/**
 * Generates a story with multiple scenes from a topic
 * @param topic The topic of the story
 * @returns An array of scene objects with prompts and narration
 */
/**
 * Generates character and style description for a story topic
 * @param topic The topic of the story
 * @param storyContent Optional story content to base character/style on
 * @returns A character and style description
 */
export const generateCharacterAndStyle = async (topic: string, forceUseApiKey?: boolean, storyContent?: string): Promise<string> => {
    try {
        const currentUser = getCurrentUser();
        if (!currentUser) {
            throw new Error("Please sign in to generate character and style.");
        }

        // Determine which AI service to use
        let aiService = await getAIService(forceUseApiKey);
        if (!aiService) {
            throw new Error("No credits remaining and no API key configured. Please add your Gemini API key or contact support for more credits.");
        }

        // Credit check is already handled in getAIService, no need to check again

        let result;
        
        if (aiService === 'firebase') {
            // Use Firebase AI Logic with free credits
            console.log('Using Firebase AI Logic for character and style generation');
            try {
                const model = getGenerativeModel(ai, { 
            model: "gemini-2.5-flash",
                    generationConfig: {
                        responseMimeType: "text/plain",
                    }
                });
                
                console.log('Generating character and style with Firebase AI Logic...');
                
                let prompt;
                if (storyContent) {
                    // Use the actual story content to generate consistent character and style
                    prompt = `Based on this story content, create a character and visual style description that matches the story:

STORY CONTENT:
${storyContent}

Create a character and visual style description that:
- Matches the main character described in the story
- Uses the visual style and mood established in the story
- Maintains consistency with the story's tone and setting
- Keeps the same character appearance, personality, and visual aesthetic

Include:
- Main character description (appearance, personality, age if human)
- Visual style (art style, color palette, mood, lighting)
- Keep it concise (2-3 sentences)
- Make it consistent with the story's established character and style

The character and style should feel like it belongs to this specific story, not a generic interpretation.`;
                } else {
                    // Fallback to topic-based generation
                    prompt = `Create a character and visual style description for a creative short film about "${topic}". 
                    Be creative and diverse! Consider:
                    - Different character types (humans, animals, objects, fantasy creatures, etc.)
                    - Various visual styles (realistic, stylized, noir, colorful, minimalist, documentary, etc.)
                    - Different moods and atmospheres (dramatic, comedic, mysterious, romantic, etc.)
                    - Various settings and time periods
                    
                    Include:
                    - Main character description (appearance, personality, age if human)
                    - Visual style (art style, color palette, mood, lighting)
                    - Keep it concise (2-3 sentences)
                    - Make it engaging and appropriate for the story tone
                    
                    Examples:
                    - "A young photographer in their 20s with a vintage camera, curious and artistic, in realistic urban photography style with natural lighting and documentary feel."
                    - "A delivery driver in their 30s, determined and observant, in noir thriller style with dramatic shadows and urban night setting."
                    - "A scientist in their 40s with a futuristic device, brilliant but reckless, in sci-fi style with blue lighting and technological atmosphere."`;
                }
                
                result = await model.generateContent(prompt);
            } catch (firebaseError: any) {
                console.log('❌ Firebase AI Logic failed:', firebaseError.message);
                // Check if user has API key for automatic fallback
                const hasGoogleApiKey = await hasUserApiKey(currentUser.uid, 'google');
                const hasFalApiKey = await hasUserApiKey(currentUser.uid, 'fal');
                const hasApiKey = hasGoogleApiKey || hasFalApiKey;
                
                if (hasApiKey) {
                    console.log('🔄 Auto-falling back to custom API key due to Firebase AI Logic error');
                    aiService = 'custom'; // Switch to custom key
                } else {
                    throw new Error(`Firebase AI Logic is not configured for this project. Please add your Gemini API key in the Dashboard, or contact support. Error: ${firebaseError.message}`);
                }
            }
        } else {
            // Firebase AI Logic succeeded - extract result
            console.log('Firebase AI Logic character response received');
        }
        
        // Handle custom API key path (either from start or fallback)
        if (aiService === 'custom') {
            // Use custom API key via secure server-side service
            const response = await authFetch(API_ENDPOINTS.apiKey.use, {
                method: 'POST',
                body: {
                    prompt: `Create a character and visual style description for a creative short film about "${topic}". 
                    Be creative and diverse! Consider:
                    - Different character types (humans, animals, objects, fantasy creatures, etc.)
                    - Various visual styles (realistic, stylized, noir, colorful, minimalist, documentary, etc.)
                    - Different moods and atmospheres (dramatic, comedic, mysterious, romantic, etc.)
                    - Various settings and time periods
                    
                    Include:
                    - Main character description (appearance, personality, age if human)
                    - Visual style (art style, color palette, mood, lighting)
                    - Keep it concise (2-3 sentences)
                    - Make it engaging and appropriate for the story tone
                    
                    Examples:
                    - "A young photographer in their 20s with a vintage camera, curious and artistic, in realistic urban photography style with natural lighting and documentary feel."
                    - "A delivery driver in their 30s, determined and observant, in noir thriller style with dramatic shadows and urban night setting."
                    - "A scientist in their 40s with a futuristic device, brilliant but reckless, in sci-fi style with blue lighting and technological atmosphere."`,
                    model: 'gemini-2.5-flash'
                }
            });
            
            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }
            
            const apiResult = await response.json();
            const parts = apiResult?.candidates?.[0]?.content?.parts || [];
            const textPart = parts.find((p: any) => typeof p?.text === 'string')?.text || '';
            result = { response: { text: () => textPart } };
        }

        const characterStyle = result.response.text().trim();
        
        // Only deduct credits after successful generation
        if (currentUser) {
            let tokenUsage = extractTokenUsage(result, 'gemini-2.5-flash');
            
            // If no token usage from custom API, estimate it
            if (!tokenUsage && aiService === 'custom') {
                const promptLength = `Create a character and visual style description for a kid-friendly story about "${topic}". 
                    Include:
                    - Main character description (appearance, personality)
                    - Visual style (art style, color palette, mood)
                    - Keep it concise (2-3 sentences)
                    - Make it suitable for children
                    
                    Example format: "A cute banana character with a tiny red cape, adventurous and curious, in a vibrant watercolor style with warm colors and soft edges."`.length;
                
                const estimatedTokens = Math.ceil(promptLength / 4) + 100; // Shorter response expected
                tokenUsage = {
                    promptTokens: Math.ceil(promptLength / 4),
                    completionTokens: 100,
                    totalTokens: estimatedTokens,
                    estimatedCost: calculateCost(estimatedTokens, 'gemini-2.5-flash'),
                    model: 'gemini-2.5-flash'
                };
                console.log('Custom API estimated token usage for character:', tokenUsage);
            }
            
            await recordUsage(
                currentUser.uid, 
                'story_generation', 
                1, // Legacy cost field
                true, 
                tokenUsage || undefined,
                aiService
            );
        }
        
        return characterStyle;
        
    } catch (error) {
        console.error("Error generating character and style:", error);
        
        if (error instanceof Error) {
            // Provide more specific error messages
            if (error.message.includes('API key')) {
                throw new Error("Authentication failed. Please check your API key configuration.");
            } else if (error.message.includes('quota') || error.message.includes('limit')) {
                throw new Error("API quota exceeded. Please try again later.");
            } else if (error.message.includes('safety')) {
                throw new Error("Content was blocked by safety filters. Please try a different topic.");
            } else if (error.message.includes('Insufficient credits')) {
                throw error; // Re-throw credit errors as-is
            }
        }
        throw new Error("Failed to generate character and style. The AI may be experiencing issues or the topic is too sensitive.");
    }
};

export const generateStory = async (topic: string, forceUseApiKey?: boolean): Promise<StoryScene[]> => {
    try {
        const currentUser = getCurrentUser();
        if (!currentUser) {
            throw new Error("Please sign in to generate stories.");
        }

        // Determine which AI service to use
        let aiService = await getAIService(forceUseApiKey);
        console.log('AI Service selected:', aiService);
        if (!aiService) {
            throw new Error("No credits remaining and no API key configured. Please add your Gemini API key or contact support for more credits.");
        }

        // Credit check is already handled in getAIService, no need to check again

        let result;
        
        if (aiService === 'firebase') {
            // Use Firebase AI Logic with free credits
            console.log('Using Firebase AI Logic for story generation');
            try {
                const model = getGenerativeModel(ai, {
                model: "gemini-2.5-flash",
                    // Try to coerce structured output where supported
                    generationConfig: {
                    responseMimeType: "application/json",
                        // responseSchema is supported in newer SDKs; harmless if ignored
                        // @ts-ignore
                        responseSchema: (storyResponseSchema as any),
                    }
                });
                
                console.log('Generating content with Firebase AI Logic...');
                result = await model.generateContent(
                    `Return ONLY JSON. Format: {"scenes":[{"prompt":"...","narration":"..."}]}.
                     Create 4-8 scenes for a creative short film about "${topic}".
                     
                     IMPORTANT: Be creative and diverse! Consider these varied approaches:
                     - Real-world scenarios (documentary, drama, comedy, thriller, romance)
                     - Different character types (humans, animals, objects, fantasy creatures)
                     - Various settings (urban, rural, historical, futuristic, fantasy, space)
                     - Different visual styles (realistic, stylized, noir, colorful, minimalist)
                     - Various themes (adventure, mystery, friendship, discovery, transformation)
                     
                     Each scene must include:
                     - prompt: a detailed, visually rich description for image generation (can be realistic or stylized)
                     - narration: 1-2 sentences to be spoken (engaging and appropriate for the story tone)
                     
                     Make each story unique and different from typical "cute character" stories. 
                     Think outside the box - could be a documentary about the topic, a thriller, a romance, 
                     a historical drama, a sci-fi adventure, or any other creative interpretation.
                     
                     Do not include any markdown or extra commentary. Only valid JSON.`
                );
            } catch (firebaseError: any) {
                console.log('❌ Firebase AI Logic failed:', firebaseError.message);
                // Check if user has API key for automatic fallback
                const hasGoogleApiKey = await hasUserApiKey(currentUser.uid, 'google');
                const hasFalApiKey = await hasUserApiKey(currentUser.uid, 'fal');
                const hasApiKey = hasGoogleApiKey || hasFalApiKey;
                
                if (hasApiKey) {
                    console.log('🔄 Auto-falling back to custom API key due to Firebase AI Logic error');
                    aiService = 'custom'; // Switch to custom key
                } else {
                    throw new Error(`Firebase AI Logic is not configured for this project. Please add your Gemini API key in the Dashboard, or contact support. Error: ${firebaseError.message}`);
                }
            }
        } else {
            // Firebase AI Logic succeeded - extract result
            console.log('Firebase AI Logic response received');
        }
        
        // Handle custom API key path (either from start or fallback)
        if (aiService === 'custom') {
            // Use custom API key via secure server-side service
            const response = await authFetch(API_ENDPOINTS.apiKey.use, {
                method: 'POST',
                body: {
                    prompt: `Return ONLY JSON. Format: {"scenes":[{"prompt":"...","narration":"..."}]}.
                             Create 4-8 scenes for a creative short film about "${topic}".
                             
                             IMPORTANT: Be creative and diverse! Consider these varied approaches:
                             - Real-world scenarios (documentary, drama, comedy, thriller, romance)
                             - Different character types (humans, animals, objects, fantasy creatures)
                             - Various settings (urban, rural, historical, futuristic, fantasy, space)
                             - Different visual styles (realistic, stylized, noir, colorful, minimalist)
                             - Various themes (adventure, mystery, friendship, discovery, transformation)
                             
                             Each scene must include:
                             - prompt: a detailed, visually rich description for image generation (can be realistic or stylized)
                             - narration: 1-2 sentences to be spoken (engaging and appropriate for the story tone)
                             
                             Make each story unique and different from typical "cute character" stories. 
                             Think outside the box - could be a documentary about the topic, a thriller, a romance, 
                             a historical drama, a sci-fi adventure, or any other creative interpretation.
                             
                             Do not include any markdown or extra commentary. Only valid JSON.`,
                    model: 'gemini-2.5-flash'
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to generate story with custom API key');
            }
            
            const apiResult = await response.json();
            const parts = apiResult?.candidates?.[0]?.content?.parts || [];
            const textPart = parts.find((p: any) => typeof p?.text === 'string')?.text || '';
            const rawText = (textPart || '').trim();
            let responseData: any;
            try {
                if (rawText.startsWith('{')) {
                    responseData = JSON.parse(rawText);
                } else {
                    const match = rawText.match(/\{[\s\S]*\}/);
                    if (match) responseData = JSON.parse(match[0]);
                }
            } catch (e) {
                console.warn('Custom-key story JSON parse failed. Raw:', rawText);
            }

            // Reuse the same collector as Firebase path
            const collectScenes = (obj: any): StoryScene[] => {
                if (!obj) return [];
                const arr: any[] = Array.isArray(obj.scenes) ? obj.scenes : [];
                const out: StoryScene[] = [];
                for (const item of arr) {
                    const prompt = item?.prompt || item?.description || item?.scene || item?.text;
                    const narration = item?.narration || item?.caption || item?.voiceover || item?.text;
                    if (typeof prompt === 'string' && typeof narration === 'string') {
                        out.push({ prompt, narration });
                    }
                }
                return out;
            };

            const scenes = collectScenes(responseData);
            if (scenes.length === 0) {
            throw new Error("Invalid story format received from API.");
            }

            if (currentUser) {
                // Estimate token usage for custom API path (Google's public API doesn't return usage metadata)
                const promptLength = `Return ONLY JSON. Format: {"scenes":[{"prompt":"...","narration":"..."}]}.
                             Create 4-8 scenes for a short, kid-friendly storyboard about "${topic}".
                             Each scene must include:
                             - prompt: a detailed, visually rich description for image generation
                             - narration: 1-2 sentences to be spoken.
                             Do not include any markdown or extra commentary. Only valid JSON.`.length;
                
                // Rough estimation: ~4 characters per token for English text
                const estimatedTokens = Math.ceil(promptLength / 4) + 200; // Add buffer for response
                const estimatedTokenUsage: TokenUsage = {
                    promptTokens: Math.ceil(promptLength / 4),
                    completionTokens: 200, // Estimated response tokens
                    totalTokens: estimatedTokens,
                    estimatedCost: calculateCost(estimatedTokens, 'gemini-2.5-flash'),
                    model: 'gemini-2.5-flash'
                };
                
                console.log('Custom API estimated token usage:', estimatedTokenUsage);
                
                await recordUsage(currentUser.uid, 'story_generation', 1, true, estimatedTokenUsage, 'custom');
            }
            return scenes;
        }

        let rawText = result.response.text().trim();
        console.log('Firebase AI Logic raw response:', rawText);
        let response: any;
        try {
            response = JSON.parse(rawText);
            console.log('Parsed Firebase AI response:', response);
        } catch (e) {
            console.warn('Story JSON parse failed, retrying with stricter instruction...');
            // Retry once with stricter instruction
            const retryModel = getGenerativeModel(ai, {
                model: "gemini-2.5-flash",
                generationConfig: { responseMimeType: "application/json" }
            });
            const retry = await retryModel.generateContent(
                `STRICT JSON ONLY. NO MARKDOWN. EXACT FORMAT: {"scenes":[{"prompt":"...","narration":"..."}]}
                 4-8 scenes about "${topic}". Keep kid-friendly. No extra keys.`
            );
            rawText = retry.response.text().trim();
            try {
                response = JSON.parse(rawText);
            } catch (e2) {
                console.error('Retry parse failed. Raw:', rawText);
                throw new Error('The story could not be parsed. Reword the topic slightly or add a character detail.');
            }
        }

        const collectScenes = (obj: any): StoryScene[] => {
            console.log('collectScenes input:', obj);
            if (!obj) return [];
            const arr: any[] = Array.isArray(obj.scenes) ? obj.scenes : [];
            console.log('Scenes array:', arr);
            const out: StoryScene[] = [];
            for (const item of arr) {
                const prompt = item?.prompt || item?.description || item?.scene || item?.text;
                const narration = item?.narration || item?.caption || item?.voiceover || item?.text;
                console.log('Processing scene item:', { item, prompt, narration });
                if (typeof prompt === 'string' && typeof narration === 'string') {
                    out.push({ prompt, narration });
                }
            }
            console.log('Final collected scenes:', out);
            return out;
        };

        const scenes = collectScenes(response);
        if (scenes.length > 0) {
            // Only deduct credits after successful story generation
            const currentUser = getCurrentUser();
            if (currentUser) {
                const tokenUsage = extractTokenUsage(result, 'gemini-2.5-flash');
                await recordUsage(
                    currentUser.uid, 
                    'story_generation', 
                    1, // Legacy cost field
                    true, 
                    tokenUsage || undefined,
                    aiService
                );
            }
            return scenes;
        }
        throw new Error("No scenes returned by AI. Try rephrasing the topic.");
    } catch (error) {
        console.error("Error generating story:", error);
        
        if (error instanceof Error) {
            // Provide more specific error messages
            if (error.message.includes('API key')) {
                throw new Error("Authentication failed. Please check your API key configuration.");
            } else if (error.message.includes('quota') || error.message.includes('limit')) {
                throw new Error("API quota exceeded. Please try again later.");
            } else if (error.message.includes('safety')) {
                throw new Error("Content was blocked by safety filters. Please try a different topic.");
            } else if (error.message.includes('Insufficient credits')) {
                throw error; // Re-throw credit errors as-is
            }
        }
        throw new Error("Failed to generate story. The AI may be experiencing issues or the topic is too sensitive.");
    }
};

const sequentialPromptsSchema = {
    type: "object",
    properties: {
        prompts: {
            type: "array",
            description: "An array of 5 sequential, continuous prompts for an image generation model.",
            items: { type: "string" },
        },
    },
    required: ["prompts"],
};

/**
 * Generates a sequence of 5 images for a scene with caching
 * Uses sophisticated "shot director" approach for cinematic quality
 * @param mainPrompt The main prompt for the scene
 * @param characterAndStyle The character and style description
 * @returns An array of base64 encoded image strings
 */
export const generateImageSequence = async (
    mainPrompt: string,
    characterAndStyle: string,
    opts?: { characterRefs?: string[]; backgroundImage?: string; frames?: number; projectId?: string; forceUseApiKey?: boolean; sceneIndex?: number; onInfo?: (info: { cached?: boolean }) => void; location?: string; props?: string[]; costumes?: string[]; sceneDirection?: string }
): Promise<string[]> => {
    try {
        const currentUser = getCurrentUser();
        if (!currentUser) {
            throw new Error("Please sign in to generate images.");
        }

        // Determine which AI service to use (text vs custom key path)
        let aiService = await getAIService(opts?.forceUseApiKey);
        if (!aiService) {
            throw new Error("No credits remaining and no API key configured. Please add your Gemini API key or contact support for more credits.");
        }

        // 1. Check cache first for cost control
        const cacheKey = generateCacheKey(mainPrompt, characterAndStyle, opts);
        const cacheDoc = doc(db, CACHE_COLLECTION, cacheKey);
        let cacheSnap: any = null;
        let usedCache = false;
        let base64Images: string[] = [];
        let perImageTokenUsages: TokenUsage[] = [];
        const desired = Math.min(Math.max(opts?.frames || 5, 1), 5);
        try {
            cacheSnap = await getDoc(cacheDoc);
        } catch (e) {
            // Ignore permission errors; treat as cache miss
            cacheSnap = null;
        }
        
        if (cacheSnap && cacheSnap.exists()) {
            usedCache = true;
            const cachedData = cacheSnap.data();
            console.log(`Cache hit for prompt: ${mainPrompt.substring(0, 50)}...`);
            // For cached images, we still need to upload them to the current project's
            // folder with the correct naming pattern so the render service can discover them.
            // If the cache contains HTTPS URLs, convert them to data URIs first.
            const cachedUrls: string[] = Array.isArray(cachedData.imageUrls) ? cachedData.imageUrls.slice(0, desired) : [];
            const urlToDataUri = async (url: string): Promise<string> => {
                try {
                    const resp = await fetch(url);
                    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                    const blob = await resp.blob();
                    const reader = new FileReader();
                    const dataUri: string = await new Promise((resolve, reject) => {
                        reader.onerror = () => reject(new Error('FileReader failed'));
                        reader.onloadend = () => resolve(String(reader.result || ''));
                        reader.readAsDataURL(blob);
                    });
                    if (!dataUri.startsWith('data:image/')) throw new Error('Invalid data URI');
                    return dataUri;
                } catch (e) {
                    console.warn('Failed to convert cached URL to data URI, using original URL:', url, e);
                    return url; // fallback — upload step will skip and keep original URL
                }
            };
            // Convert cached URLs to data URIs where needed
            base64Images = await Promise.all(
                cachedUrls.map((u) => (typeof u === 'string' && u.startsWith('http')) ? urlToDataUri(u) : Promise.resolve(String(u)))
            );
        } else {
            console.log(`Cache miss for prompt: ${mainPrompt.substring(0, 50)}...`);
            
            // For Firebase AI Logic, check credits after cache miss
        if (aiService === 'firebase') {
            const requestedFrames = Math.min(Math.max(opts?.frames || 5, 1), 5);
            console.log(`🔍 generateImageSequence: Checking ${requestedFrames} credits for user ${currentUser.uid}`);
            const hasCredits = await checkUserCredits(currentUser.uid, requestedFrames);
            console.log(`🔍 generateImageSequence: User has ${requestedFrames} credits: ${hasCredits}`);
            if (!hasCredits) {
                // Check if user has API key for fallback
                const hasGoogleApiKey = await hasUserApiKey(currentUser.uid, 'google');
                const hasFalApiKey = await hasUserApiKey(currentUser.uid, 'fal');
                const hasApiKey = hasGoogleApiKey || hasFalApiKey;
                
                if (hasApiKey) {
                    console.log(`🔄 generateImageSequence: Insufficient free credits, but user has API key - switching to BYO path`);
                    // Switch to custom API key path
                    aiService = 'custom';
                } else {
                    // Fetch profile to show a helpful message
                    const profile = await getUserProfile(currentUser.uid);
                    const available = profile?.freeCredits ?? 0;
                    console.log(`❌ generateImageSequence: Insufficient credits - need ${requestedFrames}, have ${available}`);
                    throw new Error(`Insufficient credits. This request needs ${requestedFrames} image credits, you have ${available}. Switch to Draft (3 frames) or add your Gemini API key.`);
                }
            } else {
                console.log(`✅ generateImageSequence: Credits sufficient, proceeding with generation`);
            }
        }
        
        // 2. Use sophisticated "shot director" approach for cinematic quality
        const directorSystemInstruction = `You are a film director planning a 2-second shot. Based on the following scene description, create a sequence of exactly 5 distinct, continuous camera shots that show a brief moment of action. Each shot should be a detailed visual prompt for an image generation model.
            
Return ONLY a JSON object with this exact format:
{
  "prompts": [
    "A wide shot of a knight standing before a massive, ancient stone door in a dark cavern, torchlight flickering.",
    "The knight takes a deep breath, close up on his determined face, sweat beading on his brow.",
    "A shot of the knight's gauntleted hand reaching out and placing it firmly on the cold stone door.",
    "The knight pushes with all his might, muscles straining, the door beginning to grind open with a low rumble.",
    "A sliver of brilliant golden light spills from the opening, illuminating the knight's astonished eyes."
  ]
}`

        let shotDirectorResult: any;
        
        if (aiService === 'custom') {
            try {
                // Use custom API key for shot director
                const response = await authFetch(API_ENDPOINTS.apiKey.use, {
                    method: 'POST',
                    body: {
                        prompt: `${directorSystemInstruction}\n\nScene Description: "${characterAndStyle}. ${mainPrompt}"${opts?.location ? `\nLocation: ${opts.location}` : ''}${opts?.props?.length ? `\nProps: ${opts.props.join(', ')}` : ''}${opts?.costumes?.length ? `\nCostumes: ${opts.costumes.join(', ')}` : ''}${opts?.sceneDirection ? `\nDirection Style: ${opts.sceneDirection}` : ''}`,
                        model: 'gemini-2.5-flash'
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`Shot director API request failed: ${response.status}`);
                }
            
                const apiResult = await response.json();
                const parts = apiResult?.candidates?.[0]?.content?.parts || [];
                const textPart = parts.find((p: any) => typeof p?.text === 'string')?.text || '';
                shotDirectorResult = { response: { text: () => textPart } };
            } catch (customApiError: any) {
                console.log('❌ Custom API key failed for shot director:', customApiError.message);
                console.log('🔄 Falling back to Firebase AI Logic for shot director');
                // Fall back to Firebase AI Logic
                aiService = 'firebase';
            }
        }
        
        if (aiService === 'firebase') {
            // Use Firebase AI Logic for shot director
            const shotDirectorModel = getGenerativeModel(ai, { 
            model: "gemini-2.5-flash",
                systemInstruction: directorSystemInstruction,
                generationConfig: {
                responseMimeType: "application/json",
                }
            });
            
            shotDirectorResult = await shotDirectorModel.generateContent(
                `Scene Description: "${characterAndStyle}. ${mainPrompt}"${opts?.location ? `\nLocation: ${opts.location}` : ''}${opts?.props?.length ? `\nProps: ${opts.props.join(', ')}` : ''}${opts?.costumes?.length ? `\nCostumes: ${opts.costumes.join(', ')}` : ''}${opts?.sceneDirection ? `\nDirection Style: ${opts.sceneDirection}` : ''}`
            );
        }

        const jsonStr = shotDirectorResult.response.text().trim();
        const shotList = JSON.parse(jsonStr);

        if (!shotList || !shotList.prompts || shotList.prompts.length === 0) {
            throw new Error("Failed to generate sequential prompts.");
        }

        // 3. Generate an image for each of the 5 prompts sequentially to avoid rate limiting
        const prompts = (shotList.prompts as string[]).slice(0, desired);
        for (const prompt of prompts) {
            const finalPrompt = `${characterAndStyle}. Maintain this character and style consistently. A cinematic, high quality, professional photograph of: ${prompt}` + (opts?.backgroundImage ? ' Compose the subject naturally into the provided background image with matching lighting and perspective.' : '');

            if (aiService === 'custom') {
                // Use user API key via secure proxy
                const imageInputs: string[] = [];
                if (opts?.characterRefs && opts.characterRefs.length) imageInputs.push(...opts.characterRefs);
                if (opts?.backgroundImage) imageInputs.push(opts.backgroundImage);
                const resp = await authFetch(API_ENDPOINTS.apiKey.use, {
                    method: 'POST',
                    body: { model: 'gemini-2.5-flash-image-preview', prompt: finalPrompt, imageInputs }
                });
                if (!resp.ok) throw new Error(`Custom image gen failed: HTTP ${resp.status}`);
                const json = await resp.json();
                const candidates = json?.candidates || [];
                let pushed = false;
                for (const c of candidates) {
                    const parts = c?.content?.parts || [];
                    for (const part of parts) {
                        if (part?.inline_data?.data && part?.inline_data?.mime_type) {
                            base64Images.push(`data:${part.inline_data.mime_type};base64,${part.inline_data.data}`);
                            pushed = true;
                            break;
                        }
                    }
                    if (pushed) break;
                }
                if (!pushed) throw new Error(`No image generated for prompt: "${prompt}"`);
            } else {
                // Firebase AI Logic path
                try {
                    const imagenModel = getGenerativeModel(ai, { 
                        model: 'gemini-2.5-flash-image-preview',
                        generationConfig: { responseModalities: [ResponseModality.TEXT, ResponseModality.IMAGE] }
                    });
                    // Build parts: optional character refs and background image, then prompt text
                    const parts: any[] = [];
                    if (opts?.characterRefs && opts.characterRefs.length > 0) {
                        for (const ref of opts.characterRefs) {
                            try { parts.push(fileToGenerativePart(ref)); } catch (e) { console.warn('Invalid character ref image skipped'); }
                        }
                    }
                    if (opts?.backgroundImage) {
                        try { parts.push(fileToGenerativePart(opts.backgroundImage)); } catch (e) { console.warn('Invalid background image skipped'); }
                    }
                    parts.push({ text: finalPrompt });
                    const response = await imagenModel.generateContent(parts);
                const tokenUsage = extractTokenUsage(response, 'gemini-2.5-flash-image-preview');
                if (tokenUsage) perImageTokenUsages.push(tokenUsage);
                try {
                    const inlineDataParts = response.response.inlineDataParts();
                    if (inlineDataParts?.[0]) {
                        const image = inlineDataParts[0].inlineData;
                        base64Images.push(`data:${image.mimeType};base64,${image.data}`);
                    } else {
                        const candidates = response.response.candidates;
                        if (candidates?.[0]?.content?.parts) {
                            for (const part of candidates[0].content.parts) {
                                if (part.inlineData) {
                                    const image = part.inlineData;
                                    base64Images.push(`data:${image.mimeType};base64,${image.data}`);
                                    break;
                                }
                            }
                        }
                        if (base64Images.length === 0) {
                            throw new Error(`No image generated for prompt: "${prompt}"`);
                        }
                    }
                } catch (err) {
                    console.error('Image generation failed:', err);
                throw new Error(`An image in the sequence failed to generate for prompt: "${prompt}"`);
                }
                } catch (firebaseError: any) {
                    console.log('❌ Firebase AI Logic image generation failed:', firebaseError.message);
                    // Check if user has API key for automatic fallback
                    const hasGoogleApiKey = await hasUserApiKey(currentUser.uid, 'google');
                    const hasFalApiKey = await hasUserApiKey(currentUser.uid, 'fal');
                    const hasApiKey = hasGoogleApiKey || hasFalApiKey;
                    
                    if (hasApiKey) {
                        console.log('🔄 Auto-falling back to custom API key for image generation due to Firebase error');
                        // Use custom API key path
                        const imageInputs: string[] = [];
                        if (opts?.characterRefs && opts.characterRefs.length) imageInputs.push(...opts.characterRefs);
                        if (opts?.backgroundImage) imageInputs.push(opts.backgroundImage);
                        const resp = await authFetch(API_ENDPOINTS.apiKey.use, {
                            method: 'POST',
                            body: { model: 'gemini-2.5-flash-image-preview', prompt: finalPrompt, imageInputs }
                        });
                        if (!resp.ok) throw new Error(`Custom image gen fallback failed: HTTP ${resp.status}`);
                        const json = await resp.json();
                        const candidates = json?.candidates || [];
                        let pushed = false;
                        for (const c of candidates) {
                            const parts = c?.content?.parts || [];
                            for (const part of parts) {
                                if (part.inlineData && part.inlineData.data) {
                                    base64Images.push(`data:${part.inlineData.mimeType || 'image/jpeg'};base64,${part.inlineData.data}`);
                                    pushed = true;
                                    break;
                                }
                            }
                            if (pushed) break;
                        }
                        if (!pushed) throw new Error(`No image generated via API key fallback for prompt: "${prompt}"`);
                    } else {
                        throw new Error(`Firebase AI Logic is not configured for image generation and no API key available. Please add your Gemini API key in the Dashboard. Error: ${firebaseError.message}`);
                    }
                }
            }
        }
        }
        
        // Note: Cache will be saved later after we have HTTPS URLs
        
        // Persist frames to Storage and return HTTPS URLs for durability
        const httpsUrls: string[] = [];
        try {
            const projectId = opts?.projectId || `gen-${Date.now()}`;
            for (let idx = 0; idx < base64Images.length; idx++) {
                const base64Image = base64Images[idx];
                const sceneIdx = typeof opts?.sceneIndex === 'number' ? opts.sceneIndex : 0;
                const fileName = `scene-${sceneIdx}-${idx}.jpeg`;
                const resp = await authFetch(API_ENDPOINTS.upload, {
                    method: 'POST',
                    body: { projectId, fileName, base64Image }
                });
                if (resp.ok) {
                    const json = await resp.json();
                    httpsUrls.push(json.publicUrl || base64Image);
                } else {
                    // If upload failed and we have an HTTPS URL already, keep it; otherwise drop
                    if (typeof base64Image === 'string' && base64Image.startsWith('http')) {
                        httpsUrls.push(base64Image);
                    } else {
                        console.warn('Upload failed and no HTTPS URL available, skipping frame', resp.status);
                    }
                }
            }
        } catch (e) {
            console.warn('Failed to persist generated frames; falling back to inline data URIs');
            httpsUrls.push(...base64Images);
        }

        // Record successful usage with token tracking
        if (currentUser) {
            // Aggregate actual token usage if available; otherwise, estimate
            let totalTokenUsage: TokenUsage;
            if (perImageTokenUsages.length > 0) {
                totalTokenUsage = {
                    promptTokens: perImageTokenUsages.reduce((s, u) => s + (u.promptTokens || 0), 0),
                    completionTokens: perImageTokenUsages.reduce((s, u) => s + (u.completionTokens || 0), 0),
                    totalTokens: perImageTokenUsages.reduce((s, u) => s + (u.totalTokens || 0), 0),
                    estimatedCost: perImageTokenUsages.reduce((s, u) => s + (u.estimatedCost || 0), 0),
                    model: 'gemini-2.5-flash-image-preview'
                };
            } else {
                const estimatedTokensPerImage = 1000; // fallback rough estimate
                const total = base64Images.length * estimatedTokensPerImage;
                totalTokenUsage = {
                    promptTokens: 0,
                    completionTokens: 0,
                    totalTokens: total,
                    estimatedCost: calculateCost(total, 'gemini-2.5-flash-image-preview'),
                    model: 'gemini-2.5-flash-image-preview'
                };
            }
            
            await recordUsage(
                currentUser.uid, 
                'image_generation', 
                desired, // credits equal to frames generated
                true, 
                totalTokenUsage,
                aiService
            );
        }
        
        // Save to cache now that we have stable URLs
        try {
            await setDoc(doc(db, CACHE_COLLECTION, cacheKey), {
                imageUrls: httpsUrls,
                imageCount: httpsUrls.length,
                prompt: mainPrompt,
                characterAndStyle,
                userId: currentUser?.uid || null,
                createdAt: new Date().toISOString(),
                cacheKey,
                hasBackground: !!opts?.backgroundImage,
                refCount: opts?.characterRefs?.length || 0,
            }, { merge: true });
        } catch (_) {}

        // Notify caller about cache usage if requested
        try { opts?.onInfo?.({ cached: usedCache }); } catch {}
        return httpsUrls;
    } catch (error) {
        console.error("Error generating image sequence:", error);
        
        // Record failed usage (no token usage for failed calls)
        const currentUser = getCurrentUser();
        if (currentUser) {
            const failedAiService = await getAIService();
            await recordUsage(
                currentUser.uid, 
                'image_generation', 
                Math.min(Math.max(opts?.frames || 5, 1), 5),
                false, 
                undefined, // No token usage for failed calls
                failedAiService || 'firebase'
            );
        }
        
        if (error instanceof Error) {
            if (error.message.includes('API key')) {
                throw new Error("Authentication failed. Please check your API key configuration.");
            } else if (error.message.includes('quota') || error.message.includes('limit')) {
                throw new Error("API quota exceeded. Please try again later.");
            } else if (error.message.includes('safety')) {
                throw new Error("Content was blocked by safety filters. Please try a different prompt.");
            } else if (error.message.includes('Insufficient credits')) {
                throw error; // Re-throw credit errors as-is
            }
        }
        throw new Error("Failed to generate images. The prompt might be too sensitive or the service is unavailable.");
    }
};

/**
 * Converts a data URI (base64 string) into a format suitable for the Gemini API.
 * @param base64Data The base64 data URI (e.g., "data:image/jpeg;base64,...").
 * @returns An object with mimeType and data.
 */
const fileToGenerativePart = (base64Data: string) => {
    const match = base64Data.match(/^data:(image\/[a-zA-Z]+);base64,(.*)$/);
    if (!match || match.length < 3) {
        throw new Error("Invalid base64 image format");
    }
    return {
        inlineData: {
            mimeType: match[1],
            data: match[2],
        },
    };
};

/**
 * Edits a sequence of images based on a text prompt.
 * @param base64Images An array of data URIs for the images to edit.
 * @param editPrompt The text prompt describing the desired change.
 * @returns A promise that resolves to an array of new data URIs for the edited images.
 */
export const editImageSequence = async (base64Images: string[], editPrompt: string): Promise<string[]> => {
    try {
        const editedImages: string[] = [];
        const allTokenUsage: TokenUsage[] = [];
        
        // Decide service: prefer BYO when user toggled in other flows or when Firebase AI is not configured
        let aiService: 'firebase' | 'custom' | null = await getAIService();
        if (!aiService) aiService = 'firebase'; // try firebase first; will fallback per-image if it fails

        for (const image of base64Images) {
            const imagePart = fileToGenerativePart(image);
            
            if (aiService === 'custom') {
                // BYO path via secure proxy
                const resp = await authFetch(API_ENDPOINTS.apiKey.use, {
                    method: 'POST',
                    body: {
                        model: 'gemini-2.5-flash-image-preview',
                        prompt: editPrompt,
                        imageInputs: [image]
                    }
                });
                if (!resp.ok) throw new Error(`Custom edit failed: HTTP ${resp.status}`);
                const json = await resp.json();
                const candidates = json?.candidates || [];
                let pushed = false;
                for (const c of candidates) {
                    const parts = c?.content?.parts || [];
                    for (const part of parts) {
                        if ((part as any)?.inline_data?.data && (part as any)?.inline_data?.mime_type) {
                            editedImages.push(`data:${(part as any).inline_data.mime_type};base64,${(part as any).inline_data.data}`);
                            pushed = true;
                            break;
                        }
                    }
                    if (pushed) break;
                }
                if (!pushed) throw new Error('The AI could not edit one of the images with your API key.');
                // Token usage not available from public API; skip or estimate if needed
                continue;
            }

            // Firebase AI Logic path
            try {
                const editModel = getGenerativeModel(ai, { 
                model: 'gemini-2.5-flash-image-preview',
                    generationConfig: {
                        responseModalities: [ResponseModality.IMAGE, ResponseModality.TEXT],
                    }
                });
                const response = await editModel.generateContent([
                        imagePart,
                    { text: editPrompt }
                ]);
                const tokenUsage = extractTokenUsage(response, 'gemini-2.5-flash-image-preview');
                if (tokenUsage) allTokenUsage.push(tokenUsage);

                try {
                    const inlineDataParts = response.response.inlineDataParts();
                    if (inlineDataParts?.[0]) {
                        const editedImage = inlineDataParts[0].inlineData;
                        editedImages.push(`data:${editedImage.mimeType};base64,${editedImage.data}`);
            } else {
                        const candidates = response.response.candidates;
                        if (candidates?.[0]?.content?.parts) {
                            for (const part of candidates[0].content.parts) {
                                if (part.inlineData) {
                                    const editedImage = part.inlineData;
                                    editedImages.push(`data:${editedImage.mimeType};base64,${editedImage.data}`);
                                    break;
                                }
                            }
                        }
                        if (editedImages.length === 0) {
                            throw new Error('No edited image was produced');
                        }
                    }
                } catch (err) {
                    console.error('Image editing failed (Firebase path):', err);
                    throw new Error('The AI could not edit one of the images. Please try a different prompt.');
                }
            } catch (firebaseError: any) {
                // On Firebase AI error, auto-fallback to BYO if available
                console.log('❌ Firebase AI Logic edit failed:', firebaseError?.message || firebaseError);
                const user = getCurrentUser();
                let hasApiKey = false;
                if (user) {
                    try {
                        const hasGoogle = await hasUserApiKey(user.uid, 'google');
                        const hasFal = await hasUserApiKey(user.uid, 'fal');
                        hasApiKey = hasGoogle || hasFal;
                    } catch (_) {}
                }
                if (!hasApiKey) throw new Error('AI editing is not configured. Add your Gemini API key in Dashboard or configure Firebase AI Logic.');
                aiService = 'custom';
                // re-run this image on BYO path
                const resp = await authFetch(API_ENDPOINTS.apiKey.use, {
                    method: 'POST',
                    body: { model: 'gemini-2.5-flash-image-preview', prompt: editPrompt, imageInputs: [image] }
                });
                if (!resp.ok) throw new Error(`Custom edit failed: HTTP ${resp.status}`);
                const json = await resp.json();
                let pushed = false;
                for (const c of json?.candidates || []) {
                    for (const part of (c?.content?.parts || [])) {
                        if ((part as any)?.inline_data?.data && (part as any)?.inline_data?.mime_type) {
                            editedImages.push(`data:${(part as any).inline_data.mime_type};base64,${(part as any).inline_data.data}`);
                            pushed = true;
                            break;
                        }
                    }
                    if (pushed) break;
                }
                if (!pushed) throw new Error('The AI could not edit one of the images with your API key.');
            }
        }
        
        // Record usage for all image edits
        const currentUser = getCurrentUser();
        if (currentUser && allTokenUsage.length > 0) {
            // Aggregate all token usage
            const totalTokenUsage: TokenUsage = {
                promptTokens: allTokenUsage.reduce((sum, usage) => sum + usage.promptTokens, 0),
                completionTokens: allTokenUsage.reduce((sum, usage) => sum + usage.completionTokens, 0),
                totalTokens: allTokenUsage.reduce((sum, usage) => sum + usage.totalTokens, 0),
                estimatedCost: allTokenUsage.reduce((sum, usage) => sum + usage.estimatedCost, 0),
                model: 'gemini-2.5-flash-image-preview'
            };
            
            console.log('Total image editing token usage:', totalTokenUsage);
            
            // Record usage (using image_generation operation type)
            await recordUsage(
                currentUser.uid,
                'image_generation',
                1, // Legacy cost unit
                true,
                totalTokenUsage,
                'firebase'
            );
        }
        
        return editedImages;
    } catch (error) {
        console.error("Error editing image sequence:", error);
        if (error instanceof Error) {
            if (error.message.includes('API key')) {
                throw new Error("Authentication failed. Please check your API key configuration.");
            } else if (error.message.includes('quota') || error.message.includes('limit')) {
                throw new Error("API quota exceeded. Please try again later.");
            } else if (error.message.includes('safety')) {
                throw new Error("Content was blocked by safety filters. Please try a different edit prompt.");
            }
        }
        throw new Error(error instanceof Error ? error.message : "Failed to apply edits to the image sequence.");
    }
};

/**
 * Generate a small set of character options (name + description + 1 image each)
 * Uses gemini-2.5-flash for descriptors and gemini-2.5-flash-image-preview for images.
 * Cheap default: 4 characters, 1 image per character.
 */
const CHAR_OPTIONS_CACHE = 'char_options_cache';
const coalesce = (s: string) => s.trim().toLowerCase();
export const charOptionsCacheKey = (topic: string, count: number, styleHint?: string) => {
  const base = `${coalesce(topic)}|${count}|${coalesce(styleHint || '')}`;
  let h = 0;
  for (let i = 0; i < base.length; i++) h = (h * 31 + base.charCodeAt(i)) | 0;
  return `opt_${Math.abs(h).toString(36)}`;
};

/**
 * Analyze story content to extract character information
 */
export const analyzeStoryCharacters = async (storyContent: string): Promise<{
  characters: Array<{name: string, description: string, role: string}>;
  suggestedCount: number;
}> => {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      throw new Error("Please sign in to analyze story characters.");
    }

    // Determine which AI service to use
    let aiService = await getAIService();
    if (!aiService) {
      throw new Error("No credits remaining and no API key configured.");
    }

    let result;
    
    if (aiService === 'firebase') {
      const model = getGenerativeModel(ai, { 
        model: "gemini-2.5-flash",
        generationConfig: {
          responseMimeType: "application/json",
        }
      });
      
      const prompt = `Analyze this story content and extract character information. Return ONLY valid JSON in this exact format:

{
  "characters": [
    {
      "name": "Character Name",
      "description": "Brief description of appearance and personality",
      "role": "Their role in the story (protagonist, antagonist, supporting, etc.)"
    }
  ],
  "suggestedCount": 3
}

STORY CONTENT:
${storyContent}

Rules:
- Extract ALL characters mentioned in the story
- Include main characters, supporting characters, and any named characters
- Provide brief but descriptive character descriptions
- Set suggestedCount to the number of characters found (1-6)
- If no characters are clearly defined, suggest 2-3 generic characters that would fit the story
- Focus on characters that would be important for visual generation`;

      result = await model.generateContent(prompt);
    } else {
      // Fallback to custom API key
      // TODO: Implement custom API key support for character extraction
      throw new Error('Character extraction requires Firebase AI Logic credits');
      /*const response = await fetch(`${API_ENDPOINTS.gemini.generate}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Analyze this story content and extract character information. Return ONLY valid JSON in this exact format:

{
  "characters": [
    {
      "name": "Character Name", 
      "description": "Brief description of appearance and personality",
      "role": "Their role in the story (protagonist, antagonist, supporting, etc.)"
    }
  ],
  "suggestedCount": 3
}

STORY CONTENT:
${storyContent}

Rules:
- Extract ALL characters mentioned in the story
- Include main characters, supporting characters, and any named characters
- Provide brief but descriptive character descriptions
- Set suggestedCount to the number of characters found (1-6)
- If no characters are clearly defined, suggest 2-3 generic characters that would fit the story
- Focus on characters that would be important for visual generation`,
          model: "gemini-2.5-flash"
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }
      result = await response.json();*/
    }

    const responseText = result.response?.text() || result.text || '';
    const analysis = JSON.parse(responseText);
    
    return {
      characters: analysis.characters || [],
      suggestedCount: Math.min(Math.max(analysis.suggestedCount || 2, 1), 6)
    };
  } catch (error) {
    console.error('Error analyzing story characters:', error);
    // Fallback to generic analysis
    return {
      characters: [
        { name: "Main Character", description: "The protagonist of the story", role: "protagonist" },
        { name: "Supporting Character", description: "A character who helps the main character", role: "supporting" }
      ],
      suggestedCount: 2
    };
  }
};

export const generateCharacterOptions = async (
  topic: string,
  count: number = 4,
  styleHint?: string,
  storyContent?: string
): Promise<CharacterOption[]> => {
  const options: CharacterOption[] = [];
  const currentUser = getCurrentUser();
  // Guard: require auth so we can record usage/credits if desired
  if (!currentUser) throw new Error('Please sign in to generate character options.');

  // Try cache first
  try {
    const cacheId = charOptionsCacheKey(topic, count, styleHint);
    const cacheDoc = doc(db, CHAR_OPTIONS_CACHE, cacheId);
    const snap = await getDoc(cacheDoc);
    if (snap.exists()) {
      const data = snap.data() as any;
      const optionsArr = Array.isArray(data.options) ? data.options : [];
      const createdAtIso = data.createdAt as string | undefined;
      const ttlMs = 24 * 60 * 60 * 1000; // 24h TTL
      const fresh = createdAtIso ? (Date.now() - Date.parse(createdAtIso) < ttlMs) : false;
      if (optionsArr.length > 0 && fresh) {
        return optionsArr as CharacterOption[];
      }
    }
  } catch (_) {}

  // 1) Generate character descriptors (Firebase AI Logic with fallback to custom API key)
  let list: any[] = [];
  let prompt: string;
  
  if (storyContent) {
    // Use story analysis to generate characters based on actual story content
    const analysis = await analyzeStoryCharacters(storyContent);
    const actualCount = Math.min(count, analysis.suggestedCount);
    
    prompt = `Return ONLY JSON as {"characters":[{"name":"...","description":"..."}]}.
Based on this story content, create ${actualCount} characters that match the story:

STORY CONTENT:
${storyContent}

EXTRACTED CHARACTERS:
${analysis.characters.map(char => `- ${char.name}: ${char.description} (${char.role})`).join('\n')}

Create character descriptions that:
- Match the characters identified in the story
- Maintain consistency with the story's tone and setting
- Include appearance + personality + visual art style (1-2 sentences)
- Stay true to the established character roles and relationships
${styleHint ? `Bias visual styles toward: ${styleHint}.` : ''}

Example description: "Elias Thorne, a meticulous horologist with worn spectacles and gaunt features, rendered in sepia-toned painterly style with velvety shadows."`;
  } else {
    // Fallback to topic-based generation
    prompt = `Return ONLY JSON as {"characters":[{"name":"...","description":"..."}]}.
Create ${count} distinct, kid-friendly characters that could star in a short story about "${topic}".
Each description must combine appearance + personality + visual art style (1-2 sentences).
${styleHint ? `Bias styles toward: ${styleHint}.` : ''}
Example description: "A brave banana with a tiny red cape and bright eyes, painted in warm watercolor with soft edges."`;
  }

  let usedCustom = false;
  try {
    const model = getGenerativeModel(ai, {
      model: 'gemini-2.5-flash',
      generationConfig: { responseMimeType: 'application/json' },
    });
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim();
    const json = JSON.parse(raw);
    list = Array.isArray(json.characters) ? json.characters.slice(0, count) : [];
  } catch (firebaseError: any) {
    console.log('❌ Firebase AI Logic failed for character options:', firebaseError?.message || firebaseError);
    // fallback to custom key if user has one
    let hasApiKey = false;
    if (currentUser) {
      try {
        const hasGoogleApiKey = await hasUserApiKey(currentUser.uid, 'google');
        const hasFalApiKey = await hasUserApiKey(currentUser.uid, 'fal');
        hasApiKey = hasGoogleApiKey || hasFalApiKey;
      } catch (_) {}
    }
    if (!hasApiKey) {
      throw new Error('AI is not configured for this project. Add your Gemini API key in Dashboard or configure Firebase AI Logic.');
    }
    usedCustom = true;
    const resp = await authFetch(API_ENDPOINTS.apiKey.use, {
      method: 'POST',
      body: { prompt, model: 'gemini-2.5-flash' }
    });
    if (!resp.ok) throw new Error('Failed to generate character list via API key');
    const apiResult = await resp.json();
    const parts = apiResult?.candidates?.[0]?.content?.parts || [];
    const textPart = parts.find((p: any) => typeof p?.text === 'string')?.text || '';
    const raw = (textPart || '').trim();
    const json = JSON.parse(raw);
    list = Array.isArray(json.characters) ? json.characters.slice(0, count) : [];
  }

  // 2) For each character, generate one image
  for (const ch of list) {
    const name = typeof ch.name === 'string' ? ch.name : 'Character';
    const desc = typeof ch.description === 'string' ? ch.description : 'A friendly character.';
    let dataUri: string | null = null;
    try {
      const imagenModel = getGenerativeModel(ai, {
        model: 'gemini-2.5-flash-image-preview',
        generationConfig: { responseModalities: [ResponseModality.TEXT, ResponseModality.IMAGE] },
      });
      const imgResp = await imagenModel.generateContent(`Portrait of ${desc}. ${styleHint ? `Style: ${styleHint}. `: ''}Centered, well-lit, plain background.`);
      try {
        const inlineDataParts = imgResp.response.inlineDataParts();
        if (inlineDataParts?.[0]) {
          const image = inlineDataParts[0].inlineData;
          dataUri = `data:${image.mimeType};base64,${image.data}`;
        } else {
          const candidates = imgResp.response.candidates;
          if (candidates?.[0]?.content?.parts) {
            for (const part of candidates[0].content.parts) {
              if ((part as any).inlineData) {
                const image = (part as any).inlineData;
                dataUri = `data:${image.mimeType};base64,${image.data}`;
                break;
              }
            }
          }
        }
      } catch {}
    } catch (firebaseError: any) {
      // Fallback to custom API key if available
      if (currentUser && usedCustom) {
        const resp = await authFetch(API_ENDPOINTS.apiKey.use, {
          method: 'POST',
          body: {
            model: 'gemini-2.5-flash-image-preview',
            prompt: `Portrait of ${desc}. ${styleHint ? `Style: ${styleHint}. `: ''}Centered, well-lit, plain background.`
          }
        });
        if (resp.ok) {
          const json = await resp.json();
          const candidates = json?.candidates || [];
          outer: for (const c of candidates) {
            const parts = c?.content?.parts || [];
            for (const part of parts) {
              if ((part as any)?.inline_data?.data && (part as any)?.inline_data?.mime_type) {
                dataUri = `data:${(part as any).inline_data.mime_type};base64,${(part as any).inline_data.data}`;
                break outer;
              }
            }
          }
        }
      }
    }
    if (!dataUri) throw new Error('Failed to generate a character image.');
    options.push({ id: `${Date.now()}-${options.length}`, name, description: desc, images: [dataUri] });
  }
  // Save to cache (best-effort)
  try {
    const cacheId = charOptionsCacheKey(topic, count, styleHint);
    await setDoc(doc(db, CHAR_OPTIONS_CACHE, cacheId), { options, topic, count, styleHint: styleHint || null, createdAt: new Date().toISOString() });
  } catch (_) {}
  return options;
};

export const clearCharacterOptionsCache = async (topic: string, count: number, styleHint?: string): Promise<void> => {
  try {
    const cacheId = charOptionsCacheKey(topic, count, styleHint);
    const cacheDoc = doc(db, CHAR_OPTIONS_CACHE, cacheId);
    await deleteDoc(cacheDoc);
  } catch (_) {
    // non-fatal
    }
};
