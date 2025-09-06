// Secure AI service: Firebase AI Logic (free credits) + Encrypted API keys (unlimited)
import { getAI, getGenerativeModel, VertexAIBackend, ResponseModality } from 'firebase/ai';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { firebaseApp } from '../lib/firebase';
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
const getAIService = async (): Promise<'firebase' | 'custom' | null> => {
  const currentUser = getCurrentUser();
  if (!currentUser) return null;

  const userProfile = await getUserProfile(currentUser.uid);
  if (!userProfile) return null;

  // Check if user has free credits remaining
  const hasCredits = await checkUserCredits(currentUser.uid, 1);
  if (hasCredits) {
    return 'firebase'; // Use Firebase AI Logic with free credits
  }

  // Check if user has API key stored server-side
  const hasApiKey = await hasUserApiKey(currentUser.uid);
  if (hasApiKey) {
    return 'custom'; // Use custom API key for unlimited usage
  }

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
 * @returns A character and style description
 */
export const generateCharacterAndStyle = async (topic: string): Promise<string> => {
    try {
        const currentUser = getCurrentUser();
        if (!currentUser) {
            throw new Error("Please sign in to generate character and style.");
        }

        // Determine which AI service to use
        const aiService = await getAIService();
        if (!aiService) {
            throw new Error("No credits remaining and no API key configured. Please add your Gemini API key or contact support for more credits.");
        }

        // For Firebase AI Logic, check credits before making the API call
        if (aiService === 'firebase') {
            const hasCredits = await checkUserCredits(currentUser.uid, 1);
            if (!hasCredits) {
                throw new Error("Insufficient credits. Please add your Gemini API key or contact support for more credits.");
            }
        }

        let result;
        
        if (aiService === 'firebase') {
            // Use Firebase AI Logic with free credits
            console.log('Using Firebase AI Logic for character and style generation');
            const model = getGenerativeModel(ai, { 
                model: "gemini-2.5-flash",
                generationConfig: {
                    responseMimeType: "text/plain",
                }
            });
            
            console.log('Generating character and style with Firebase AI Logic...');
            result = await model.generateContent(
                `Create a character and visual style description for a kid-friendly story about "${topic}". 
                Include:
                - Main character description (appearance, personality)
                - Visual style (art style, color palette, mood)
                - Keep it concise (2-3 sentences)
                - Make it suitable for children
                
                Example format: "A cute banana character with a tiny red cape, adventurous and curious, in a vibrant watercolor style with warm colors and soft edges."`
            );
            console.log('Firebase AI Logic character response received');
            
            // Extract token usage from response
            const tokenUsage = extractTokenUsage(result, 'gemini-2.5-flash');
            if (tokenUsage) {
                console.log('Token usage:', tokenUsage);
            }
            
        } else {
            // Use custom API key via secure server-side service
            const response = await authFetch(API_ENDPOINTS.apiKey.use, {
                method: 'POST',
                body: {
                    prompt: `Create a character and visual style description for a kid-friendly story about "${topic}". 
                    Include:
                    - Main character description (appearance, personality)
                    - Visual style (art style, color palette, mood)
                    - Keep it concise (2-3 sentences)
                    - Make it suitable for children
                    
                    Example format: "A cute banana character with a tiny red cape, adventurous and curious, in a vibrant watercolor style with warm colors and soft edges."`,
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

export const generateStory = async (topic: string): Promise<StoryScene[]> => {
    try {
        const currentUser = getCurrentUser();
        if (!currentUser) {
            throw new Error("Please sign in to generate stories.");
        }

        // Determine which AI service to use
        const aiService = await getAIService();
        console.log('AI Service selected:', aiService);
        if (!aiService) {
            throw new Error("No credits remaining and no API key configured. Please add your Gemini API key or contact support for more credits.");
        }

        // For Firebase AI Logic, check credits before making the API call
        if (aiService === 'firebase') {
            const hasCredits = await checkUserCredits(currentUser.uid, 1);
            if (!hasCredits) {
                throw new Error("Insufficient credits. Please add your Gemini API key or contact support for more credits.");
            }
        }

        let result;
        
        if (aiService === 'firebase') {
            // Use Firebase AI Logic with free credits
            console.log('Using Firebase AI Logic for story generation');
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
                 Create 4-8 scenes for a short, kid-friendly storyboard about "${topic}".
                 Each scene must include:
                 - prompt: a detailed, visually rich description for image generation
                 - narration: 1-2 sentences to be spoken.
                 Do not include any markdown or extra commentary. Only valid JSON.`
            );
            console.log('Firebase AI Logic response received');
            
            // Extract token usage from response
            const tokenUsage = extractTokenUsage(result, 'gemini-2.5-flash');
            if (tokenUsage) {
                console.log('Story generation token usage:', tokenUsage);
            }
            
        } else {
            // Use custom API key via secure server-side service
            const response = await authFetch(API_ENDPOINTS.apiKey.use, {
                method: 'POST',
                body: {
                    prompt: `Return ONLY JSON. Format: {"scenes":[{"prompt":"...","narration":"..."}]}.
                             Create 4-8 scenes for a short, kid-friendly storyboard about "${topic}".
                             Each scene must include:
                             - prompt: a detailed, visually rich description for image generation
                             - narration: 1-2 sentences to be spoken.
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
    opts?: { characterRefs?: string[]; backgroundImage?: string; frames?: number }
): Promise<string[]> => {
    try {
        // Check user credits if authenticated
        const currentUser = getCurrentUser();
        if (currentUser) {
            const hasCredits = await checkUserCredits(currentUser.uid, 5); // 5 images = 5 credits
            if (!hasCredits) {
                throw new Error("Insufficient credits. Please add your own API key or contact support.");
            }
        }

        // 1. Check cache first for cost control
        const cacheKey = generateCacheKey(mainPrompt, characterAndStyle, opts);
        const cacheDoc = doc(db, CACHE_COLLECTION, cacheKey);
        let cacheSnap: any = null;
        try {
            cacheSnap = await getDoc(cacheDoc);
        } catch (e) {
            // Ignore permission errors; treat as cache miss
            cacheSnap = null;
        }
        
        if (cacheSnap && cacheSnap.exists()) {
            const cachedData = cacheSnap.data();
            console.log(`Cache hit for prompt: ${mainPrompt.substring(0, 50)}...`);
            return cachedData.imageUrls;
        }
        
        console.log(`Cache miss for prompt: ${mainPrompt.substring(0, 50)}...`);
        
        // 2. Use sophisticated "shot director" approach for cinematic quality
        const directorSystemInstruction = `You are a film director planning a 2-second shot. Based on the following scene description, create a sequence of exactly 5 distinct, continuous camera shots that show a brief moment of action. Each shot should be a detailed visual prompt for an image generation model.
            
Example Output:
1. A wide shot of a knight standing before a massive, ancient stone door in a dark cavern, torchlight flickering.
2. The knight takes a deep breath, close up on his determined face, sweat beading on his brow.
3. A shot of the knight's gauntleted hand reaching out and placing it firmly on the cold stone door.
4. The knight pushes with all his might, muscles straining, the door beginning to grind open with a low rumble.
5. A sliver of brilliant golden light spills from the opening, illuminating the knight's astonished eyes.`

        // Create a GenerativeModel instance for shot director
        const shotDirectorModel = getGenerativeModel(ai, { 
            model: "gemini-2.5-flash",
            systemInstruction: directorSystemInstruction,
            generationConfig: {
                responseMimeType: "application/json",
            }
        });
        
        const shotDirectorResult = await shotDirectorModel.generateContent(
            `Scene Description: "${characterAndStyle}. ${mainPrompt}"`
        );

        const jsonStr = shotDirectorResult.response.text().trim();
        const shotList = JSON.parse(jsonStr);

        if (!shotList || !shotList.prompts || shotList.prompts.length === 0) {
            throw new Error("Failed to generate sequential prompts.");
        }

        // 3. Generate an image for each of the 5 prompts sequentially to avoid rate limiting
        const base64Images: string[] = [];
        const desired = Math.min(Math.max(opts?.frames || 5, 1), 5);
        const prompts = (shotList.prompts as string[]).slice(0, desired);
        for (const prompt of prompts) {
            const finalPrompt = `${characterAndStyle}. Maintain this character and style consistently. A cinematic, high quality, professional photograph of: ${prompt}` + (opts?.backgroundImage ? ' Compose the subject naturally into the provided background image with matching lighting and perspective.' : '');

            // Create a GenerativeModel instance using nano-bana (gemini-2.5-flash-image-preview) for contest
            const imagenModel = getGenerativeModel(ai, { 
                model: 'gemini-2.5-flash-image-preview',
                generationConfig: {
                    responseModalities: [ResponseModality.TEXT, ResponseModality.IMAGE],
                }
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

            // Extract token usage from response
            const tokenUsage = extractTokenUsage(response, 'gemini-2.5-flash-image-preview');
            if (tokenUsage) {
                console.log('Image generation token usage:', tokenUsage);
            }

            // Handle the generated image using Firebase AI Logic nano-bana API
            try {
                const inlineDataParts = response.response.inlineDataParts();
                if (inlineDataParts?.[0]) {
                    const image = inlineDataParts[0].inlineData;
                    base64Images.push(`data:${image.mimeType};base64,${image.data}`);
                } else {
                    // Fallback: check candidates for interleaved content
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
        }
        
        // 4. Save to cache for future use (cost control)
        if (currentUser) {
            try {
                await setDoc(cacheDoc, {
                    imageUrls: base64Images,
                    prompt: mainPrompt,
                    characterAndStyle: characterAndStyle,
                    userId: currentUser.uid, // Required by security rules
                    createdAt: new Date().toISOString(),
                    cacheKey: cacheKey,
                    hasBackground: !!opts?.backgroundImage,
                    refCount: opts?.characterRefs?.length || 0
                });
                console.log(`Cached ${base64Images.length} images for future use`);
            } catch (cacheError) {
                console.warn('Failed to cache images:', cacheError);
                // Don't fail the whole operation if caching fails
            }
        }
        
        // Record successful usage with token tracking
        if (currentUser) {
            // Calculate total token usage for all images generated
            const totalTokenUsage: TokenUsage = {
                promptTokens: 0,
                completionTokens: 0,
                totalTokens: 0,
                estimatedCost: 0,
                model: 'gemini-2.5-flash-image-preview'
            };
            
            // Note: For image generation, we don't have individual token usage per image
            // The API doesn't return detailed token breakdown for image generation
            // We'll use a reasonable estimate based on the number of images and complexity
            const estimatedTokensPerImage = 1000; // Rough estimate
            totalTokenUsage.totalTokens = base64Images.length * estimatedTokensPerImage;
            totalTokenUsage.estimatedCost = calculateCost(totalTokenUsage.totalTokens, 'gemini-2.5-flash-image-preview');
            
            await recordUsage(
                currentUser.uid, 
                'image_generation', 
                5, // Legacy cost field
                true, 
                totalTokenUsage,
                'firebase'
            );
        }
        
        return base64Images;

    } catch (error) {
        console.error("Error generating image sequence:", error);
        
        // Record failed usage (no token usage for failed calls)
        const currentUser = getCurrentUser();
        if (currentUser) {
            await recordUsage(
                currentUser.uid, 
                'image_generation', 
                5, // Legacy cost field
                false, 
                undefined, // No token usage for failed calls
                'firebase'
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
        
        for (const image of base64Images) {
            const imagePart = fileToGenerativePart(image);
            
            // Create a GenerativeModel instance for image editing using Gemini (Imagen doesn't support image input yet)
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
            
            // Extract token usage from response
            const tokenUsage = extractTokenUsage(response, 'gemini-2.5-flash-image-preview');
            if (tokenUsage) {
                console.log('Image editing token usage:', tokenUsage);
                allTokenUsage.push(tokenUsage);
            }

            // Handle the edited image using Firebase AI Logic API
            try {
                const inlineDataParts = response.response.inlineDataParts();
                if (inlineDataParts?.[0]) {
                    const editedImage = inlineDataParts[0].inlineData;
                    editedImages.push(`data:${editedImage.mimeType};base64,${editedImage.data}`);
                } else {
                    // Fallback: check candidates for interleaved content
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
                        throw new Error("The AI could not edit one of the images. Please try a different prompt.");
                    }
                }
            } catch (err) {
                console.error('Image editing failed:', err);
                throw new Error("The AI could not edit one of the images. Please try a different prompt.");
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
