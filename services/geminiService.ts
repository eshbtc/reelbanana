// services/geminiService.ts
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { geminiApiKey } from './apiConfig';

if (!geminiApiKey) {
    throw new Error("Gemini API Key is not configured. Please set REEL_BANANA_GEMINI_API_KEY or API_KEY in your environment.");
}

const ai = new GoogleGenAI({ apiKey: geminiApiKey });

// Helper function to convert image data to a Gemini-compatible part
const fileToGenerativePart = async (base64Data: string) => {
    // Expected format: "data:image/jpeg;base64,..."
    const match = base64Data.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) {
        throw new Error("Invalid base64 image data format");
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
        throw new Error(error instanceof Error ? error.message : "Failed to apply edits to the image sequence.");
    }
};
