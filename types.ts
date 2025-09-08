// Define the application's core types with hackathon-winning features
export type SceneStatus = 'idle' | 'generating' | 'success' | 'error';

// Director-level controls for professional video production
export type CameraMovement = 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'static';
export type TransitionType = 'fade' | 'wipeleft' | 'wiperight' | 'circleopen' | 'dissolve' | 'none';
export type StylePreset = 'none' | 'ghibli' | 'wes-anderson' | 'film-noir' | 'pixel-art' | 'claymation';

export interface Scene {
  id: string;
  prompt: string;
  narration: string;
  imageUrls?: string[];
  variantImageUrls?: string[];
  status: SceneStatus;
  error?: string;
  // Indicates if the latest images came from cache
  cached?: boolean;
  // Director-level controls for hackathon-winning features
  camera?: CameraMovement;
  transition?: TransitionType;
  duration?: number; // Scene duration in seconds
  // Optional background photo for reality blending (data URI)
  backgroundImage?: string;
  // Optional style preset for visual morphing
  stylePreset?: StylePreset;
  // Voice and model settings
  voiceId?: string; // ElevenLabs voice ID
  voiceName?: string; // Display name for voice
  videoModel?: string; // Video generation model (e.g., 'fal-ai/veo3-fast', 'fal-ai/veo3')
  sceneDirection?: string; // AI scene direction for continuity (e.g., 'cinematic', 'documentary')
  // Scene details for enhanced video generation
  location?: string; // Scene location/setting (e.g., 'forest', 'office', 'beach')
  props?: string[]; // Props and objects in the scene (e.g., ['sword', 'magic book', 'crystal'])
  costumes?: string[]; // Character costumes/clothing (e.g., ['medieval armor', 'business suit', 'casual wear'])
  // Video generation results
  videoUrl?: string; // Generated video URL for this scene
  videoStatus?: 'idle' | 'generating' | 'success' | 'error'; // Video generation status
}

export interface CharacterOption {
  id: string;
  name: string;
  description: string; // character + style summary
  images: string[]; // data URIs or https URLs
}
