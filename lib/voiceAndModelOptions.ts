// Voice and model options for the editor with real API data

import { ElevenLabsVoice, FALModel, getVoices, getModels } from './apiDataFetcher';

export interface VoiceOption {
  id: string;
  name: string;
  description: string;
  gender: 'male' | 'female' | 'neutral';
  age: 'child' | 'young' | 'adult' | 'elderly';
  style: 'professional' | 'casual' | 'dramatic' | 'friendly' | 'mysterious';
  voiceId: string; // ElevenLabs voice ID
}

export interface VideoModelOption {
  id: string;
  name: string;
  description: string;
  speed: 'fast' | 'standard' | 'premium';
  quality: 'draft' | 'standard' | 'high';
  cost: 'low' | 'medium' | 'high';
  pricing?: {
    input?: number;
    output?: number;
  };
}

// AI Scene Direction options for movie continuity
export interface SceneDirectionOption {
  id: string;
  name: string;
  description: string;
  style: 'cinematic' | 'documentary' | 'commercial' | 'artistic' | 'minimal';
  cameraWork: 'dynamic' | 'static' | 'mixed';
  transitions: 'smooth' | 'dramatic' | 'minimal';
}

export const SCENE_DIRECTION_OPTIONS: SceneDirectionOption[] = [
  {
    id: 'cinematic',
    name: 'Cinematic',
    description: 'Hollywood-style storytelling with dynamic camera work',
    style: 'cinematic',
    cameraWork: 'dynamic',
    transitions: 'smooth'
  },
  {
    id: 'documentary',
    name: 'Documentary',
    description: 'Realistic, informative style with steady camera work',
    style: 'documentary',
    cameraWork: 'static',
    transitions: 'minimal'
  },
  {
    id: 'commercial',
    name: 'Commercial',
    description: 'Engaging, promotional style with mixed camera work',
    style: 'commercial',
    cameraWork: 'mixed',
    transitions: 'dramatic'
  },
  {
    id: 'artistic',
    name: 'Artistic',
    description: 'Creative, experimental style with artistic transitions',
    style: 'artistic',
    cameraWork: 'dynamic',
    transitions: 'dramatic'
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean, simple style with minimal camera movement',
    style: 'minimal',
    cameraWork: 'static',
    transitions: 'minimal'
  }
];

// Convert ElevenLabs voices to our format
export function convertElevenLabsVoice(voice: ElevenLabsVoice): VoiceOption {
  // Map voice names to characteristics
  const voiceCharacteristics: Record<string, { gender: 'male' | 'female' | 'neutral', age: 'child' | 'young' | 'adult' | 'elderly', style: 'professional' | 'casual' | 'dramatic' | 'friendly' | 'mysterious' }> = {
    'Rachel': { gender: 'female', age: 'young', style: 'friendly' },
    'Domi': { gender: 'female', age: 'adult', style: 'professional' },
    'Bella': { gender: 'female', age: 'young', style: 'friendly' },
    'Antoni': { gender: 'male', age: 'adult', style: 'professional' },
    'Elli': { gender: 'female', age: 'young', style: 'casual' },
    'Josh': { gender: 'male', age: 'adult', style: 'dramatic' },
    'Arnold': { gender: 'male', age: 'elderly', style: 'dramatic' },
    'Adam': { gender: 'male', age: 'adult', style: 'professional' },
    'Sam': { gender: 'male', age: 'adult', style: 'friendly' },
    'Clyde': { gender: 'male', age: 'adult', style: 'mysterious' }
  };

  const characteristics = voiceCharacteristics[voice.name] || { gender: 'neutral', age: 'adult', style: 'professional' };

  return {
    id: voice.voice_id,
    name: voice.name,
    description: voice.description || `${characteristics.gender} voice with ${characteristics.style} style`,
    gender: characteristics.gender,
    age: characteristics.age,
    style: characteristics.style,
    voiceId: voice.voice_id
  };
}

// Convert FAL models to our format
export function convertFALModel(model: FALModel): VideoModelOption {
  // Determine characteristics based on model ID
  let speed: 'fast' | 'standard' | 'premium' = 'standard';
  let quality: 'draft' | 'standard' | 'high' = 'standard';
  let cost: 'low' | 'medium' | 'high' = 'medium';

  if (model.id.includes('fast')) {
    speed = 'fast';
    quality = 'draft';
    cost = 'low';
  } else if (model.id.includes('veo3') && !model.id.includes('fast')) {
    speed = 'standard';
    quality = 'standard';
    cost = 'medium';
  } else if (model.id.includes('ltx') || model.id.includes('ltxv')) {
    speed = 'fast';
    quality = 'standard';
    cost = 'low';  // 96% cheaper than Veo3!
  } else if (model.id.includes('runway')) {
    speed = 'premium';
    quality = 'high';
    cost = 'high';
  } else if (model.id.includes('stable')) {
    speed = 'fast';
    quality = 'draft';
    cost = 'low';
  }

  return {
    id: model.id,
    name: model.name,
    description: model.description,
    speed,
    quality,
    cost,
    pricing: model.pricing
  };
}

// Get voices from API (with fallback)
export async function getVoiceOptions(): Promise<VoiceOption[]> {
  try {
    const elevenLabsVoices = await getVoices();
    return elevenLabsVoices.map(convertElevenLabsVoice);
  } catch (error) {
    console.error('Failed to load voices, using fallback:', error);
    // Fallback to hardcoded voices
    return [
      {
        id: '21m00Tcm4TlvDq8ikWAM',
        name: 'Rachel',
        description: 'Warm, friendly female voice',
        gender: 'female',
        age: 'young',
        style: 'friendly',
        voiceId: '21m00Tcm4TlvDq8ikWAM'
      },
      {
        id: 'AZnzlk1XvdvUeBnXmlld',
        name: 'Domi',
        description: 'Smooth, sophisticated female voice',
        gender: 'female',
        age: 'adult',
        style: 'professional',
        voiceId: 'AZnzlk1XvdvUeBnXmlld'
      }
    ];
  }
}

// Get models from API (with fallback)
export async function getVideoModelOptions(): Promise<VideoModelOption[]> {
  try {
    const falModels = await getModels();
    return falModels.map(convertFALModel);
  } catch (error) {
    console.error('Failed to load models, using fallback:', error);
    // Fallback to hardcoded models
    return [
      {
        id: 'fal-ai/veo3-fast/image-to-video',
        name: 'Veo3 Fast',
        description: 'Quick generation, good quality, cost-effective',
        speed: 'fast',
        quality: 'draft',
        cost: 'low'
      },
      {
        id: 'fal-ai/veo3/image-to-video',
        name: 'Veo3 Standard',
        description: 'Balanced speed and quality',
        speed: 'standard',
        quality: 'standard',
        cost: 'medium'
      }
    ];
  }
}

// Helper functions
export const getVoiceById = async (id: string): Promise<VoiceOption | undefined> => {
  const voices = await getVoiceOptions();
  return voices.find(voice => voice.id === id);
};

export const getVideoModelById = async (id: string): Promise<VideoModelOption | undefined> => {
  const models = await getVideoModelOptions();
  return models.find(model => model.id === id);
};

export const getDefaultVoice = async (): Promise<VoiceOption> => {
  const voices = await getVoiceOptions();
  return voices[0] || {
    id: '21m00Tcm4TlvDq8ikWAM',
    name: 'Rachel',
    description: 'Warm, friendly female voice',
    gender: 'female',
    age: 'young',
    style: 'friendly',
    voiceId: '21m00Tcm4TlvDq8ikWAM'
  };
};

export const getDefaultVideoModel = async (): Promise<VideoModelOption> => {
  const models = await getVideoModelOptions();
  return models[0] || {
    id: 'fal-ai/veo3-fast/image-to-video',
    name: 'Veo3 Fast',
    description: 'Quick generation, good quality, cost-effective',
    speed: 'fast',
    quality: 'draft',
    cost: 'low'
  };
};

export const getSceneDirectionById = (id: string): SceneDirectionOption | undefined => {
  return SCENE_DIRECTION_OPTIONS.find(direction => direction.id === id);
};

export const getDefaultSceneDirection = (): SceneDirectionOption => {
  return SCENE_DIRECTION_OPTIONS[0]; // Cinematic
};
