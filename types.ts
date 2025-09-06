// Fix: Define the application's core types, which were previously missing.
export type SceneStatus = 'idle' | 'generating' | 'success' | 'error';

export type CameraMovement = 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'static';
export type TransitionType = 'fade' | 'wipeleft' | 'wiperight' | 'circleopen' | 'dissolve' | 'none';

export interface Scene {
  id: string;
  prompt: string;
  narration: string;
  imageUrls?: string[]; // Changed from imageUrl
  status: SceneStatus;
  error?: string;
  // Director-level controls
  camera?: CameraMovement;
  transition?: TransitionType;
  duration?: number; // Scene duration in seconds
}
