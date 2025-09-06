// Fix: Implement the Gemini API service. This file was previously missing.
import { GoogleGenAI, Type } from "@google/genai";

// Initialization according to guidelines. API_KEY is expected to be in the environment.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
        throw new Error("Failed to generate story. Please try again.");
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
            const finalPrompt = `${characterAndStyle}. A cinematic, high quality, professional photograph of: ${prompt}`;
            
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