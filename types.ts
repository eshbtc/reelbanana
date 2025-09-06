// Fix: Define the application's core types, which were previously missing.
export type SceneStatus = 'idle' | 'generating' | 'success' | 'error';

export interface Scene {
  id: string;
  prompt: string;
  narration: string;
  imageUrls?: string[]; // Changed from imageUrl
  status: SceneStatus;
  error?: string;
}
