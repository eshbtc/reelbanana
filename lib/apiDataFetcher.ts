// Utility to fetch real voice and model data from APIs

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  description?: string;
  category: string;
  settings?: {
    stability: number;
    similarity_boost: number;
  };
  sharing?: {
    status: string;
    history_item_sample_id?: string;
  };
  high_quality_base_model_ids?: string[];
  safety_control?: string;
  voice_verification?: {
    requires_verification: boolean;
    is_verified: boolean;
    verification_failures: string[];
    verification_attempts: string[];
  };
  permissions?: string[];
  fine_tuning?: {
    model_id?: string;
    is_allowed_to_fine_tune: boolean;
    finetuning_state: string;
    verification_attempts: string[];
    verification_failures: string[];
    verification_attempts_count: number;
    manual_verification_requested: boolean;
    language?: string;
  };
}

export interface FALModel {
  id: string;
  name: string;
  description: string;
  type: string;
  pricing?: {
    input?: number;
    output?: number;
  };
  capabilities?: string[];
}

// Cache for API data
let voicesCache: ElevenLabsVoice[] | null = null;
let modelsCache: FALModel[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Fetch available voices from ElevenLabs API
 */
export async function fetchElevenLabsVoices(): Promise<ElevenLabsVoice[]> {
  try {
    // For now, return a curated list of popular ElevenLabs voices
    // In production, you would make an API call to: GET https://api.elevenlabs.io/v1/voices
    const popularVoices: ElevenLabsVoice[] = [
      {
        voice_id: "21m00Tcm4TlvDq8ikWAM",
        name: "Rachel",
        description: "Warm, friendly female voice",
        category: "premade"
      },
      {
        voice_id: "AZnzlk1XvdvUeBnXmlld",
        name: "Domi",
        description: "Smooth, sophisticated female voice",
        category: "premade"
      },
      {
        voice_id: "EXAVITQu4vr4xnSDxMaL",
        name: "Bella",
        description: "Cheerful, upbeat female voice",
        category: "premade"
      },
      {
        voice_id: "ErXwobaYiN019PkySvjV",
        name: "Antoni",
        description: "Smooth, charismatic male voice",
        category: "premade"
      },
      {
        voice_id: "MF3mGyEYCl7XYWbV9V6O",
        name: "Elli",
        description: "Young, energetic female voice",
        category: "premade"
      },
      {
        voice_id: "TxGEqnHWrfWFTfGW9XjX",
        name: "Josh",
        description: "Deep, authoritative male voice",
        category: "premade"
      },
      {
        voice_id: "VR6AewLTigWG4xSOukaG",
        name: "Arnold",
        description: "Gruff, experienced male voice",
        category: "premade"
      },
      {
        voice_id: "pNInz6obpgDQGcFmaJgB",
        name: "Adam",
        description: "Confident, professional male voice",
        category: "premade"
      },
      {
        voice_id: "yoZ06aMxZJJ28mfd3POQ",
        name: "Sam",
        description: "Friendly, conversational male voice",
        category: "premade"
      },
      {
        voice_id: "2EiwWnXFnvU5JabPnv8n",
        name: "Clyde",
        description: "Deep, mysterious male voice",
        category: "premade"
      }
    ];

    return popularVoices;
  } catch (error) {
    console.error('Failed to fetch ElevenLabs voices:', error);
    return [];
  }
}

/**
 * Fetch available models from FAL AI API
 */
export async function fetchFALModels(): Promise<FALModel[]> {
  try {
    // For now, return a curated list of popular FAL image2video models
    // In production, you would make an API call to: GET https://fal.run/fal-ai/models
    const image2videoModels: FALModel[] = [
      {
        id: "fal-ai/veo3-fast/image-to-video",
        name: "Veo3 Fast",
        description: "Quick generation, good quality, cost-effective",
        type: "image2video",
        pricing: {
          input: 0.01,
          output: 0.05
        },
        capabilities: ["image2video", "fast", "cost-effective"]
      },
      {
        id: "fal-ai/veo3/image-to-video",
        name: "Veo3 Standard",
        description: "Balanced speed and quality",
        type: "image2video",
        pricing: {
          input: 0.02,
          output: 0.10
        },
        capabilities: ["image2video", "standard", "balanced"]
      },
      {
        id: "fal-ai/runway-gen3/image-to-video",
        name: "Runway Gen3",
        description: "Cinematic quality, great for storytelling",
        type: "image2video",
        pricing: {
          input: 0.015,
          output: 0.08
        },
        capabilities: ["image2video", "cinematic", "storytelling"]
      },
      {
        id: "fal-ai/ltxv-13b-098-distilled/image-to-video",
        name: "LTX Video",
        description: "High quality, longer videos",
        type: "image2video",
        pricing: {
          input: 0.03,
          output: 0.15
        },
        capabilities: ["image2video", "long-form", "high-quality"]
      },
      {
        id: "fal-ai/stable-video-diffusion/image-to-video",
        name: "Stable Video Diffusion",
        description: "Open source alternative, good for experimentation",
        type: "image2video",
        pricing: {
          input: 0.005,
          output: 0.02
        },
        capabilities: ["image2video", "open-source", "experimental"]
      }
    ];

    return image2videoModels;
  } catch (error) {
    console.error('Failed to fetch FAL models:', error);
    return [];
  }
}

/**
 * Get cached or fresh voice data
 */
export async function getVoices(): Promise<ElevenLabsVoice[]> {
  const now = Date.now();
  
  if (voicesCache && (now - cacheTimestamp) < CACHE_DURATION) {
    return voicesCache;
  }

  voicesCache = await fetchElevenLabsVoices();
  cacheTimestamp = now;
  return voicesCache;
}

/**
 * Get cached or fresh model data
 */
export async function getModels(): Promise<FALModel[]> {
  const now = Date.now();
  
  if (modelsCache && (now - cacheTimestamp) < CACHE_DURATION) {
    return modelsCache;
  }

  modelsCache = await fetchFALModels();
  cacheTimestamp = now;
  return modelsCache;
}

/**
 * Clear cache (useful for testing or forcing refresh)
 */
export function clearCache(): void {
  voicesCache = null;
  modelsCache = null;
  cacheTimestamp = 0;
}

