// Gemini API service with hybrid security approach, caching, and user authentication
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { apiConfig } from '../config/apiConfig';
import { getCurrentUser, getUserProfile, recordUsage, checkUserCredits } from './authService';

// Hybrid approach: Use user's API key, fallback to environment variable
const getApiKey = async (): Promise<string> => {
  const currentUser = getCurrentUser();
  
  if (currentUser) {
    try {
      const userProfile = await getUserProfile(currentUser.uid);
      if (userProfile?.apiKey) {
        return userProfile.apiKey;
      }
    } catch (error) {
      console.warn('Failed to get user API key, falling back to environment key:', error);
    }
  }
  
  // Fallback to environment variable
  const envApiKey = process.env.REEL_BANANA_GEMINI_API_KEY || process.env.API_KEY;
  if (!envApiKey) {
    throw new Error("No API key available. Please sign in and add your Gemini API key, or contact support.");
  }
  
  return envApiKey;
};

// Initialize Firebase for caching
const firebaseApp = initializeApp(apiConfig.firebase);
const db = getFirestore(firebaseApp);

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
    type: Type.OBJECT,
    properties: {
        scenes: {
            type: Type.ARRAY,
            description: "An array of 4-8 scenes for the storyboard.",
            items: {
                type: Type.OBJECT,
                properties: {
                    prompt: {
                        type: Type.STRING,
                        description: "A detailed, visually rich prompt for an image generation model. Describe the scene, characters, setting, and mood in a single paragraph. Should be in English. Example: 'A cute, fluffy banana character, with big googly eyes and a cheerful smile, is surfing on a giant wave of milk. The sun is shining brightly in a clear blue sky, and other breakfast cereal characters are cheering from the shore.'",
                    },
                    narration: {
                        type: Type.STRING,
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
        // Check user credits if authenticated
        const currentUser = getCurrentUser();
        if (currentUser) {
            const hasCredits = await checkUserCredits(currentUser.uid, 1);
            if (!hasCredits) {
                throw new Error("Insufficient credits. Please add your own API key or contact support.");
            }
        }

        const apiKey = await getApiKey();
        const ai = new GoogleGenAI({ apiKey });
        
        const result = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Create a short, creative, and kid-friendly storyboard script about "${topic}". The story should have a clear beginning, middle, and end.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: storyResponseSchema,
            },
        });

        const jsonStr = result.text.trim();
        const response = JSON.parse(jsonStr);

        if (response && response.scenes && Array.isArray(response.scenes)) {
            const scenes = response.scenes.filter(
                (scene: any): scene is StoryScene =>
                    typeof scene.prompt === 'string' && typeof scene.narration === 'string'
            );
            
            // Record successful usage
            if (currentUser) {
                await recordUsage(currentUser.uid, 'story_generation', 1, true);
            }
            
            return scenes;
        } else {
            throw new Error("Invalid story format received from API.");
        }
    } catch (error) {
        console.error("Error generating story:", error);
        
        // Record failed usage
        const currentUser = getCurrentUser();
        if (currentUser) {
            await recordUsage(currentUser.uid, 'story_generation', 1, false);
        }
        
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
    type: Type.OBJECT,
    properties: {
        prompts: {
            type: Type.ARRAY,
            description: "An array of 5 sequential, continuous prompts for an image generation model.",
            items: { type: Type.STRING },
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
        const cacheSnap = await getDoc(cacheDoc);
        
        if (cacheSnap.exists()) {
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

        const apiKey = await getApiKey();
        const ai = new GoogleGenAI({ apiKey });
        
        const shotDirectorResult = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Scene Description: "${characterAndStyle}. ${mainPrompt}"`,
            config: {
                systemInstruction: directorSystemInstruction,
                responseMimeType: "application/json",
                responseSchema: sequentialPromptsSchema,
            },
        });

        const jsonStr = shotDirectorResult.text.trim();
        const shotList = JSON.parse(jsonStr);

        if (!shotList || !shotList.prompts || shotList.prompts.length === 0) {
            throw new Error("Failed to generate sequential prompts.");
        }

        // 3. Generate an image for each of the 5 prompts sequentially to avoid rate limiting
        const base64Images: string[] = [];
        for (const prompt of shotList.prompts) {
            const finalPrompt = `${characterAndStyle}. Maintain this character and style consistently. A cinematic, high quality, professional photograph of: ${prompt}`;
            
            const response = await ai.models.generateImages({
                model: 'imagen-4.0-generate-001',
                prompt: finalPrompt,
                config: {
                    numberOfImages: 1,
                    outputMimeType: 'image/jpeg',
                    aspectRatio: '16:9',
                },
            });

            if (response.generatedImages && response.generatedImages.length > 0) {
                const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
                base64Images.push(`data:image/jpeg;base64,${base64ImageBytes}`);
            } else {
                // If one image fails, we'll stop the sequence for this scene
                throw new Error(`An image in the sequence failed to generate for prompt: "${prompt}"`);
            }
        }
        
        // 4. Save to cache for future use (cost control)
        try {
            await setDoc(cacheDoc, {
                imageUrls: base64Images,
                prompt: mainPrompt,
                characterAndStyle: characterAndStyle,
                createdAt: new Date().toISOString(),
                cacheKey: cacheKey
            });
            console.log(`Cached ${base64Images.length} images for future use`);
        } catch (cacheError) {
            console.warn('Failed to cache images:', cacheError);
            // Don't fail the whole operation if caching fails
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
        const apiKey = await getApiKey();
        const ai = new GoogleGenAI({ apiKey });
        
        const editedImages: string[] = [];
        for (const image of base64Images) {
            const imagePart = fileToGenerativePart(image);
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image-preview',
                contents: {
                    parts: [
                        imagePart,
                        { text: editPrompt },
                    ],
                },
                config: {
                    responseModalities: [Modality.IMAGE, Modality.TEXT],
                },
            });

            const imageResponsePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);
            if (imageResponsePart?.inlineData) {
                const mimeType = imageResponsePart.inlineData.mimeType;
                const base64Data = imageResponsePart.inlineData.data;
                editedImages.push(`data:${mimeType};base64,${base64Data}`);
            } else {
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