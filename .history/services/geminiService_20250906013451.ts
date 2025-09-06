// Gemini API service with hybrid security approach and caching
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { apiConfig } from '../config/apiConfig';

// Hybrid approach: Use environment variable with fallback
// In production, this should be set via Google Cloud Secret Manager
// In development, it can be set via .env file
const geminiApiKey = process.env.REEL_BANANA_GEMINI_API_KEY || process.env.API_KEY;

if (!geminiApiKey) {
    console.error("CRITICAL: No Gemini API Key found. Please set either REEL_BANANA_GEMINI_API_KEY or ensure the standard API_KEY is available in your environment.");
    throw new Error("Gemini API Key is not configured. Please set REEL_BANANA_GEMINI_API_KEY or API_KEY in your environment.");
}

const ai = new GoogleGenAI({ apiKey: geminiApiKey });

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
=======
if (!geminiApiKey) {
    throw new Error("Gemini API Key is not configured. Please set REEL_BANANA_GEMINI_API_KEY or API_KEY in your environment.");
>>>>>>> 525e7be8ee157e7a550ccb5e75f8fabb4e2b59bb
}

const ai = new GoogleGenAI({ apiKey: geminiApiKey });

<<<<<<< HEAD
        const jsonStr = result.text.trim();
        const response = JSON.parse(jsonStr);

        if (response && response.scenes && Array.isArray(response.scenes)) {
            return response.scenes.filter(
                (scene: any): scene is StoryScene =>
                    typeof scene.prompt === 'string' && typeof scene.narration === 'string'
            );
        } else {
            throw new Error("Invalid story format received from API.");
        }
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

export const generateImageSequence = async (mainPrompt: string, characterAndStyle: string): Promise<string[]> => {
    try {
        // 1. Check cache first
        const cacheKey = generateCacheKey(mainPrompt, characterAndStyle);
        const cacheDoc = doc(db, CACHE_COLLECTION, cacheKey);
        const cacheSnap = await getDoc(cacheDoc);
        
        if (cacheSnap.exists()) {
            const cachedData = cacheSnap.data();
            console.log(`Cache hit for prompt: ${mainPrompt.substring(0, 50)}...`);
            return cachedData.imageUrls;
        }
        
        console.log(`Cache miss for prompt: ${mainPrompt.substring(0, 50)}...`);
        // Step 1: Act as a "shot director" to generate 5 sequential prompts.
        const directorSystemInstruction = `You are a film director planning a 2-second shot. Based on the following scene description, create a sequence of exactly 5 distinct, continuous camera shots that show a brief moment of action. Each shot should be a detailed visual prompt for an image generation model.
            
Example Output:
1. A wide shot of a knight standing before a massive, ancient stone door in a dark cavern, torchlight flickering.
2. The knight takes a deep breath, close up on his determined face, sweat beading on his brow.
3. A shot of the knight's gauntleted hand reaching out and placing it firmly on the cold stone door.
4. The knight pushes with all his might, muscles straining, the door beginning to grind open with a low rumble.
5. A sliver of brilliant golden light spills from the opening, illuminating the knight's astonished eyes.`

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

        // Step 2: Generate an image for each of the 5 prompts sequentially to avoid rate limiting.
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
                // If one image fails, we'll stop the sequence for this scene.
                throw new Error(`An image in the sequence failed to generate for prompt: "${prompt}"`);
            }
        }
        
        return base64Images;

    } catch (error) {
        console.error("Error generating image sequence:", error);
        if (error instanceof Error) {
            if (error.message.includes('API key')) {
                throw new Error("Authentication failed. Please check your API key configuration.");
            } else if (error.message.includes('quota') || error.message.includes('limit')) {
                throw new Error("API quota exceeded. Please try again later.");
            } else if (error.message.includes('safety')) {
                throw new Error("Content was blocked by safety filters. Please try a different prompt.");
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
=======
// Helper function to convert image data to a Gemini-compatible part
const fileToGenerativePart = async (base64Data: string) => {
    // Expected format: "data:image/jpeg;base64,..."
    const match = base64Data.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) {
        throw new Error("Invalid base64 image data format");
>>>>>>> 525e7be8ee157e7a550ccb5e75f8fabb4e2b59bb
    }
    const mimeType = match[1];
    const data = match[2];
    return {
        inlineData: {
            data,
            mimeType,
        },
    };
};


/**
 * Generates a 4-6 beat story outline from a topic using Gemini.
 * @param topic The topic of the story.
 * @returns An array of scene objects, each with a prompt and narration.
 */
export const generateStory = async (topic: string): Promise<{ prompt: string; narration: string }[]> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Create a 4-beat visual storyboard script for a short, one-minute movie based on the topic: "${topic}". For each beat, provide a "prompt" for an AI image generator (describe the scene visually) and a "narration" (a short sentence for a voiceover). Ensure the prompts are distinct but follow a coherent story.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            prompt: {
                                type: Type.STRING,
                                description: "A detailed visual description for an AI image generator to create the scene."
                            },
                            narration: {
                                type: Type.STRING,
                                description: "A short, single sentence of voiceover narration for this scene."
                            },
                        },
                        required: ["prompt", "narration"]
                    }
                }
            }
        });

        const jsonText = response.text.trim();
        const storyScenes = JSON.parse(jsonText);

        if (!Array.isArray(storyScenes) || storyScenes.length === 0) {
            throw new Error("AI failed to generate a valid story structure.");
        }
        
        return storyScenes;

    } catch (error) {
        console.error("Error generating story with Gemini:", error);
        throw new Error("Failed to generate story. The AI may be experiencing issues or the topic is too sensitive.");
    }
};

/**
 * Generates a sequence of 5 slightly varied images for a scene.
 * @param scenePrompt The base prompt for the scene.
 * @param characterAndStyle The consistent character and style description.
 * @returns An array of base64 encoded image strings.
 */
export const generateImageSequence = async (scenePrompt: string, characterAndStyle: string): Promise<string[]> => {
    try {
        // First, create a "shot director" prompt to generate varied prompts
        const directorPrompt = `You are a film shot director. Based on the following scene description, create 5 slightly different camera shots to form a short, animated sequence.
        
        Character & Style Guide (MUST be included in every shot prompt): "${characterAndStyle}"
        Scene Description: "${scenePrompt}"
        
        For each of the 5 shots, describe it as a single, detailed prompt for an AI image generator. Vary things like camera angle (low angle, close-up, wide shot), character expression, or a minor action. Keep the core scene and character consistent.`;

        const directorResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: directorPrompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        shots: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        }
                    },
                    required: ["shots"]
                }
            }
        });
        const { shots } = JSON.parse(directorResponse.text);

        if (!shots || shots.length === 0) {
            throw new Error("The AI shot director failed to generate prompts.");
        }

        // Generate 5 images in parallel using the generated shot prompts
        const imagePromises = shots.slice(0, 5).map((shot: string) => 
            ai.models.generateImages({
                model: 'imagen-4.0-generate-001',
                prompt: shot,
                config: {
                    numberOfImages: 1,
                    outputMimeType: 'image/jpeg'
                },
            })
        );
        
        const imageResults = await Promise.all(imagePromises);

        const base64Images = imageResults.map(res => {
            if (!res.generatedImages || res.generatedImages.length === 0) {
                throw new Error("Imagen failed to return an image for a shot.");
            }
            const base64Bytes = res.generatedImages[0].image.imageBytes;
            return `data:image/jpeg;base64,${base64Bytes}`;
        });
        
        return base64Images;

    } catch (error) {
        console.error("Error generating image sequence with Imagen:", error);
        throw new Error("Failed to generate images. The prompt might be too sensitive or the service is unavailable.");
    }
};


/**
 * Edits an existing image sequence based on a user prompt.
 * @param imageUrls An array of base64 image strings to be edited.
 * @param editPrompt The user's instruction for the edit.
 * @returns A new array of edited base64 image strings.
 */
export const editImageSequence = async (imageUrls: string[], editPrompt: string): Promise<string[]> => {
    try {
        const editPromises = imageUrls.map(async (imageUrl) => {
            const imagePart = await fileToGenerativePart(imageUrl);

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image-preview',
                contents: {
                    parts: [
                        imagePart,
                        { text: editPrompt }
                    ],
                },
                config: {
                    responseModalities: [Modality.IMAGE, Modality.TEXT],
                },
            });

            // Find the image part in the response
            const imagePartResponse = response.candidates?.[0]?.content?.parts.find(part => part.inlineData);
            if (!imagePartResponse || !imagePartResponse.inlineData) {
                // If the model replies with text only (e.g., safety rejection), use that as the error.
                const textResponse = response.text?.trim();
                throw new Error(textResponse || 'Image editing failed to return an image.');
            }

            const base64Bytes = imagePartResponse.inlineData.data;
            const mimeType = imagePartResponse.inlineData.mimeType;
            return `data:${mimeType};base64,${base64Bytes}`;
        });

        return await Promise.all(editPromises);

    } catch (error) {
        console.error("Error editing image sequence:", error);
<<<<<<< HEAD
        if (error instanceof Error) {
            if (error.message.includes('API key')) {
                throw new Error("Authentication failed. Please check your API key configuration.");
            } else if (error.message.includes('quota') || error.message.includes('limit')) {
                throw new Error("API quota exceeded. Please try again later.");
            } else if (error.message.includes('safety')) {
                throw new Error("Content was blocked by safety filters. Please try a different edit prompt.");
            }
        }
=======
>>>>>>> 525e7be8ee157e7a550ccb5e75f8fabb4e2b59bb
        throw new Error(error instanceof Error ? error.message : "Failed to apply edits to the image sequence.");
    }
};
