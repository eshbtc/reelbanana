
// Gemini API service with hybrid security approach
import { GoogleGenAI, Type, Modality } from "@google/genai";

// Hybrid approach: Use environment variable with fallback
// In production, this should be set via Google Cloud Secret Manager
// In development, it can be set via .env file
const geminiApiKey = process.env.REEL_BANANA_GEMINI_API_KEY || process.env.API_KEY;

if (!geminiApiKey) {
    console.error("CRITICAL: No Gemini API Key found. Please set either REEL_BANANA_GEMINI_API_KEY or ensure the standard API_KEY is available in your environment.");
    throw new Error("Gemini API Key is not configured. Please set REEL_BANANA_GEMINI_API_KEY or API_KEY in your environment.");
}

const ai = new GoogleGenAI({ apiKey: geminiApiKey });

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

export const generateStory = async (topic: string): Promise<StoryScene[]> => {
    try {
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
        throw new Error("Failed to generate image sequence. Please try again.");
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
        throw new Error(error instanceof Error ? error.message : "Failed to edit image sequence. Please try again.");
    }
};
