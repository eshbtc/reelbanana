import { hasUserApiKey, getCurrentUser } from './authService';

export interface UserApiKeysStatus {
  google: boolean;
  fal: boolean;
  elevenlabs: boolean;
}

export const getUserApiKeysStatus = async (userId?: string): Promise<UserApiKeysStatus> => {
  const uid = userId || getCurrentUser()?.uid;
  if (!uid) {
    return { google: false, fal: false, elevenlabs: false };
  }
  try {
    const [google, fal, elevenlabs] = await Promise.all([
      hasUserApiKey(uid, 'google'),
      hasUserApiKey(uid, 'fal'),
      hasUserApiKey(uid, 'elevenlabs'),
    ]);
    return { google, fal, elevenlabs };
  } catch {
    return { google: false, fal: false, elevenlabs: false };
  }
};

export const hasAnyUserApiKey = async (userId?: string): Promise<boolean> => {
  const status = await getUserApiKeysStatus(userId);
  return status.google || status.fal || status.elevenlabs;
};

