// Secure AI service: Firebase AI Logic (free credits) + Encrypted API keys (unlimited)
import { getAI, getGenerativeModel, VertexAIBackend, ResponseModality } from 'firebase/ai';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { firebaseApp } from '../lib/firebase';
import { getCurrentUser, getUserProfile, recordUsage, checkUserCredits, hasUserApiKey } from './authService';
import { API_ENDPOINTS } from '../config/apiConfig';
import { authFetch } from '../lib/authFetch';
import { getAppCheckToken } from '../lib/appCheck';

// Use centralized Firebase app
const db = getFirestore(firebaseApp);


// Initialize Firebase AI Logic with Vertex AI backend (global for nano-bana/gemini-2.5-flash-image-preview)
const ai = getAI(firebaseApp, { backend: new VertexAIBackend('global') });

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

// Simple hash function for cache keys
const generateCacheKey = (prompt: string, characterAndStyle: string): string => {
  const combined = `${characterAndStyle}|||${prompt}`;
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
            
        } else {
            // Use custom API key via secure server-side service
            const response = await authFetch(API_ENDPOINTS.apiKey.use, {
                method: 'POST',
                body: {
                    prompt: `Create a short, creative, and kid-friendly storyboard script about "${topic}". The story should have a clear beginning, middle, and end.`,
                    model: 'gemini-2.5-flash'
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to generate story with custom API key');
            }
            
            const result = await response.json();
            const jsonStr = result.candidates[0].content.parts[0].text.trim();
            const responseData = JSON.parse(jsonStr);
            
            // Validate the response format
            console.log('Custom API response data:', responseData);
            if (responseData && responseData.scenes && Array.isArray(responseData.scenes)) {
                const scenes = responseData.scenes.filter(
                    (scene: any): scene is StoryScene =>
                        typeof scene.prompt === 'string' && typeof scene.narration === 'string'
                );
                
                console.log('Filtered scenes:', scenes);
                if (scenes.length === 0) {
                    throw new Error("No valid scenes found in API response. Please try a different topic.");
                }
                
                // Only deduct credits after successful story generation
                if (currentUser) {
                    await recordUsage(currentUser.uid, 'story_generation', 1, true);
                }
                
                return scenes;
            } else {
                console.error('Invalid response format:', responseData);
                throw new Error(`Invalid story format received from API. Expected {scenes: [...]} but got: ${JSON.stringify(responseData)}`);
            }
        }

        const rawText = result.response.text().trim();
        console.log('Firebase AI Logic raw response:', rawText);
        let response: any;
        try {
            response = JSON.parse(rawText);
            console.log('Parsed Firebase AI response:', response);
        } catch (e) {
            console.warn('Story JSON parse failed. Raw:', rawText);
            throw new Error('Invalid story JSON received from AI.');
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
                await recordUsage(currentUser.uid, 'story_generation', 1, true);
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
export const generateImageSequence = async (mainPrompt: string, characterAndStyle: string): Promise<string[]> => {
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
        const cacheKey = generateCacheKey(mainPrompt, characterAndStyle);
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
        for (const prompt of shotList.prompts) {
            const finalPrompt = `${characterAndStyle}. Maintain this character and style consistently. A cinematic, high quality, professional photograph of: ${prompt}`;
            
            // Create a GenerativeModel instance using nano-bana (gemini-2.5-flash-image-preview) for contest
            const imagenModel = getGenerativeModel(ai, { 
                model: 'gemini-2.5-flash-image-preview',
                generationConfig: {
                    responseModalities: [ResponseModality.TEXT, ResponseModality.IMAGE],
                }
            });
            
            const response = await imagenModel.generateContent(finalPrompt);

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
                    cacheKey: cacheKey
                });
                console.log(`Cached ${base64Images.length} images for future use`);
            } catch (cacheError) {
                console.warn('Failed to cache images:', cacheError);
                // Don't fail the whole operation if caching fails
            }
        }
        
        // Record successful usage
        if (currentUser) {
            await recordUsage(currentUser.uid, 'image_generation', 5, true);
        }
        
        return base64Images;

    } catch (error) {
        console.error("Error generating image sequence:", error);
        
        // Record failed usage
        const currentUser = getCurrentUser();
        if (currentUser) {
            await recordUsage(currentUser.uid, 'image_generation', 5, false);
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
