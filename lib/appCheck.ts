// Centralized App Check token helper (dynamic import for compatibility)
export const getAppCheckToken = async (): Promise<string | null> => {
  try {
    const { getAppCheck, getToken } = await import('firebase/app-check');
    const { firebaseApp } = await import('./firebase');
    const appCheck = getAppCheck(firebaseApp);
    const tokenResponse = await getToken(appCheck, false);
    return tokenResponse.token;
  } catch (error) {
    console.warn('Failed to get App Check token:', error);
    return null;
  }
};

export default getAppCheckToken;
