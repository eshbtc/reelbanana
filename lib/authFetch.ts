// Centralized authenticated fetch helper: attaches Firebase ID token and App Check token
import { getAuth } from 'firebase/auth';

export type AuthFetchOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: any; // Will be JSON.stringify'ed if provided
};

export const authFetch = async (url: string, options: AuthFetchOptions = {}) => {
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
    }
  } catch (e) {
    // Silently fail for App Check token
  }

  // Attach Firebase ID token
  const { firebaseApp } = await import('./firebase');
  const auth = getAuth(firebaseApp);
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('User not authenticated');
  }
  const idToken = await currentUser.getIdToken();
  headers['Authorization'] = `Bearer ${idToken}`;

  // JSON body support
  let body: BodyInit | undefined;
  if (options.body !== undefined) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }

  const response = await fetch(url, { method, headers, body });
  return response;
};

export default authFetch;

