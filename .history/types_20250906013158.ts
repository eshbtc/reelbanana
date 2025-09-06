// Define the application's core types with hackathon-winning features
export type SceneStatus = 'idle' | 'generating' | 'success' | 'error';

// Director-level controls for professional video production
export type CameraMovement = 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'static';
export type TransitionType = 'fade' | 'wipeleft' | 'wiperight' | 'circleopen' | 'dissolve' | 'none';

export interface Scene {
  id: string;
  prompt: string;
  narration: string;
  imageUrls?: string[];
  status: SceneStatus;
  error?: string;
  // Director-level controls for hackathon-winning features
  camera?: CameraMovement;
  transition?: TransitionType;
  duration?: number; // Scene duration in seconds
}
