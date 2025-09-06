// Centralized App Check token helper
import { getToken } from 'firebase/app-check';
import { appCheck } from './firebase';

export const getAppCheckToken = async (): Promise<string | null> => {
  try {
    const tokenResponse = await getToken(appCheck, false);
    return tokenResponse.token;
  } catch (error) {
    console.warn('Failed to get App Check token:', error);
    return null;
  }
};

export default getAppCheckToken;
