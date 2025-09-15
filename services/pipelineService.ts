import { apiCall, API_ENDPOINTS } from '../config/apiConfig';

// Upload
export interface UploadImageRequest {
  projectId: string;
  base64Image: string; // data URI
  fileName: string; // e.g., scene-0-0.jpeg
}
export interface UploadImageResponse {
  gsPath?: string;
  cached?: boolean;
  message?: string;
}
export const uploadImage = (req: UploadImageRequest) =>
  apiCall(API_ENDPOINTS.upload, req, 'Failed to upload image') as Promise<UploadImageResponse>;

// Narration
export interface NarrateRequest {
  projectId: string;
  narrationScript: string;
  emotion?: string;
  voiceId?: string;
  voiceName?: string;
  jobId?: string;
}
export interface NarrateResponse {
  gsAudioPath: string;
  narrationScript?: string;
  cached?: boolean;
}
export const narrate = (req: NarrateRequest) =>
  apiCall(API_ENDPOINTS.narrate, req, 'Failed to generate narration') as Promise<NarrateResponse>;

// Alignment
export interface AlignRequest { projectId: string; gsAudioPath: string; jobId?: string }
export interface AlignResponse { srtPath: string; cached?: boolean }
export const alignCaptions = (req: AlignRequest) =>
  apiCall(API_ENDPOINTS.align, req, 'Failed to align captions') as Promise<AlignResponse>;

// Music
export interface ComposeRequest { projectId: string; narrationScript: string; jobId?: string }
export interface ComposeResponse { gsMusicPath?: string; cached?: boolean }
export const composeMusic = (req: ComposeRequest) =>
  apiCall(API_ENDPOINTS.compose, req, 'Failed to compose music') as Promise<ComposeResponse>;

// Render
export interface RenderSceneSpec {
  narration: string;
  imageCount: number;
  camera?: string;
  transition?: string;
  duration?: number;
}
export interface RenderRequest {
  projectId: string;
  scenes: RenderSceneSpec[];
  gsAudioPath?: string;
  srtPath?: string;
  gsMusicPath?: string;
  useFal?: boolean;
  force?: boolean;
  autoGenerateClips?: boolean;
  forceClips?: boolean;
  clipSeconds?: number;
  clipConcurrency?: number;
  clipModel?: string;
  published?: boolean;
  jobId?: string;
  // New aspect ratio and export preset support
  targetW?: number;
  targetH?: number;
  aspectRatio?: string;
  exportPreset?: string;
}
export interface RenderResponse {
  videoUrl: string;
  cached?: boolean;
}
export const renderVideo = (req: RenderRequest) =>
  apiCall(API_ENDPOINTS.render, req, 'Failed to render video') as Promise<RenderResponse>;

export const markPublished = (projectId: string) =>
  apiCall(API_ENDPOINTS.render, { projectId, published: true }, 'Failed to finalize published video URL') as Promise<RenderResponse>;

// Polish
export interface PolishRequest { projectId: string; videoUrl: string; userId?: string }
export interface PolishResponse { polishedUrl?: string; cached?: boolean }
export const polishVideo = (req: PolishRequest) =>
  apiCall(API_ENDPOINTS.polish, req, 'Failed to polish video') as Promise<PolishResponse>;

// Playback tracking
export interface PlaybackEventRequest {
  projectId: string;
  success: boolean;
  error?: string;
  timestamp: string;
  videoType: 'polished' | 'original';
}
export const trackPlayback = (req: PlaybackEventRequest) =>
  apiCall(API_ENDPOINTS.playbackTracking, req, 'Failed to track playback') as Promise<{ ok?: boolean }>;

// Clips probe via signed URLs
export interface SignedClipsResponse { projectId: string; count: number; items: Array<{ name: string; url: string; index?: number }> }
export const getSignedClips = async (projectId: string): Promise<SignedClipsResponse> => {
  const { authFetch } = await import('../lib/authFetch');
  const resp = await authFetch(`${API_ENDPOINTS.signedClips}/${encodeURIComponent(projectId)}`, { method: 'GET' });
  if (!resp.ok) {
    throw new Error(`Failed to get signed clips: HTTP_${resp.status}`);
  }
  return resp.json();
};
