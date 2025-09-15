// Define the application's core types with hackathon-winning features
export type SceneStatus = 'idle' | 'generating' | 'success' | 'error';

// Director-level controls for professional video production
export type CameraMovement = 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'static';
export type TransitionType = 'fade' | 'wipeleft' | 'wiperight' | 'circleopen' | 'dissolve' | 'none';
export type StylePreset = 'none' | 'ghibli' | 'wes-anderson' | 'film-noir' | 'pixel-art' | 'claymation';

// Aspect ratio and export presets
export type AspectRatio = '16:9' | '9:16' | '1:1';
export type ExportPreset = 'youtube' | 'tiktok' | 'square' | 'custom';

export interface AspectRatioConfig {
  id: AspectRatio;
  name: string;
  description: string;
  width: number;
  height: number;
  icon: string;
}

export interface ExportPresetConfig {
  id: ExportPreset;
  name: string;
  description: string;
  platform: string;
  aspectRatio: AspectRatio;
  resolution: { width: number; height: number };
  bitrate: string;
  container: string;
}

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

// Brand Kit types for Pro/Studio features
export interface BrandKit {
  id: string;
  name: string;
  description?: string;
  logo?: string; // URL to logo image
  primaryColor?: string; // Hex color
  secondaryColor?: string; // Hex color
  accentColor?: string; // Hex color
  fontFamily?: string;
  brandVoice?: string; // Tone and style description
  brandGuidelines?: string; // Additional brand guidelines
  createdAt: Date;
  updatedAt: Date;
  isDefault?: boolean;
}

export interface ReviewLink {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: 'active' | 'archived' | 'expired';
  expiresAt?: Date;
  // Permissions array for public actions on the link
  permissions: ('view' | 'comment' | 'approve')[];
  // Optional password protection
  password?: string;
  // Secure token used in the public URL
  token: string;
  // Owner and analytics
  createdBy: string;
  accessCount?: number;
  lastAccessedAt?: Date;
  // Reviewer allowlist (emails)
  reviewers: string[];
  createdAt: Date;
  updatedAt?: Date;
}

export interface ReviewComment {
  id: string;
  reviewLinkId: string; // Reference to the review link
  authorEmail?: string;
  authorName: string;
  content: string;
  timestamp: Date;
  // Optional moderation/triage fields
  status: 'pending' | 'approved' | 'rejected';
  resolved?: boolean;
  sceneId?: string; // If comment is scene-specific
  parentId?: string; // For threaded comments
  position?: { x: number; y: number }; // Optional position overlay
}

export interface ReviewApproval {
  id: string;
  reviewLinkId: string;
  reviewerEmail: string;
  reviewerName: string;
  approved: boolean;
  comments?: string;
  timestamp: Date;
  status?: string;
  feedback?: string;
}
