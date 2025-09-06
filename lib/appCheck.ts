// Centralized App Check token helper (dynamic import for compatibility)
export const getAppCheckToken = async (): Promise<string | null> => {
  try {
    const { getToken } = await import('firebase/app-check');
    const { appCheck } = await import('./firebase');
    const tokenResponse = await getToken(appCheck, false);
    return tokenResponse.token;
  } catch (error) {
    console.warn('Failed to get App Check token:', error);
    return null;
  }
};

export default getAppCheckToken;
