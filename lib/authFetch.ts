// Centralized authenticated fetch helper: attaches Firebase ID token and App Check token
import { getAuth } from 'firebase/auth';

export type AuthFetchOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: any; // Will be JSON.stringify'ed if provided
};

export const authFetch = async (url: string, options: AuthFetchOptions = {}) => {
  console.log('🔐 authFetch called for:', url);
  const method = options.method || 'GET';
  const headers: Record<string, string> = {
    ...(options.headers || {}),
  };

  // Attach App Check token
  try {
    const { getAppCheckToken } = await import('./appCheck');
    const token = await getAppCheckToken();
    if (token) {
      headers['X-Firebase-AppCheck'] = token;
      console.log('🔐 App Check token attached');
    } else {
      console.warn('🔐 No App Check token available');
    }
  } catch (e) {
    console.warn('🔐 Failed to get App Check token:', e);
  }

  // Attach Firebase ID token
  const { firebaseApp } = await import('./firebase');
  const auth = getAuth(firebaseApp);
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.error('🔐 No current user for authentication');
    throw new Error('User not authenticated');
  }
  const idToken = await currentUser.getIdToken();
  headers['Authorization'] = `Bearer ${idToken}`;
  console.log('🔐 Firebase ID token attached');

  // JSON body support
  let body: BodyInit | undefined;
  if (options.body !== undefined) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }

  console.log('🔐 Making fetch request:', { method, url, headers: Object.keys(headers) });
  const response = await fetch(url, { method, headers, body });
  console.log('🔐 Fetch response:', response.status, response.statusText);
  return response;
};

export default authFetch;

