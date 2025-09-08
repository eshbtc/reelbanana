// Authentication service with Google Sign-In and user management
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  User
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { firebaseApp } from '../lib/firebase';
import { API_ENDPOINTS } from '../config/apiConfig';
import { authFetch } from '../lib/authFetch';

// Use centralized Firebase app
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);


// Google Auth Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');

// User interface
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  encryptedApiKey?: string; // Encrypted user's custom Gemini API key for unlimited usage
  freeCredits: number; // Free API calls remaining
  totalUsage: number; // Total API calls made
  isAdmin?: boolean; // Admin role - bypasses rate limits and credit limits
  createdAt: string;
  lastLoginAt: string;
}

// Token usage information from API calls
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number; // Cost in USD
  model: string;
}

// Usage tracking interface
export interface UsageRecord {
  userId: string;
  operation: 'story_generation' | 'image_generation' | 'music_composition' | 'video_rendering';
  timestamp: string;
  cost: number; // API cost in credits (legacy field)
  success: boolean;
  tokenUsage?: TokenUsage; // New field for detailed token tracking
  apiService: 'firebase' | 'custom'; // Track which service was used
}

/**
 * Sign in with Google
 */
export const signInWithGoogle = async (): Promise<UserProfile> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    // Create or update user profile
    const userProfile = await createOrUpdateUserProfile(user);
    
    return userProfile;
  } catch (error) {
    console.error('Google Sign-In Error:', error);
    throw new Error('Failed to sign in with Google');
  }
};

/**
 * Sign out user
 */
export const signOutUser = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Sign out error:', error);
    throw new Error('Failed to sign out');
  }
};

/**
 * Get current user
 */
export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

/**
 * Listen to auth state changes
 */
export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

/**
 * Create or update user profile in Firestore
 */
const createOrUpdateUserProfile = async (user: User): Promise<UserProfile> => {
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);
  
  const now = new Date().toISOString();
  
  if (userSnap.exists()) {
    // Update existing user
    const userData = userSnap.data() as UserProfile;
    const updatedProfile: Partial<UserProfile> = {
      lastLoginAt: now,
      displayName: user.displayName || userData.displayName,
      photoURL: user.photoURL || userData.photoURL,
    };
    
    await updateDoc(userRef, updatedProfile);
    
    return { ...userData, ...updatedProfile };
  } else {
    // Create new user
    const newProfile: UserProfile = {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || 'Anonymous User',
      photoURL: user.photoURL || undefined,
      freeCredits: 50, // Start with 50 free API calls
      totalUsage: 0,
      createdAt: now,
      lastLoginAt: now,
    };
    
    await setDoc(userRef, newProfile);
    
    return newProfile;
  }
};

/**
 * Get user profile from Firestore
 */
export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      return userSnap.data() as UserProfile;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting user profile:', error);
    
    // Check if it's a network blocking issue
    if (error instanceof Error && error.message.includes('ERR_BLOCKED_BY_CLIENT')) {
      throw new Error('Firestore requests are being blocked. Please disable your ad blocker for this site or add reelbanana.ai to your whitelist.');
    }
    
    return null;
  }
};

/**
 * Securely store user's custom API key via server-side service
 */
export const updateUserApiKey = async (userId: string, apiKey: string, email: string): Promise<void> => {
  try {
    const response = await authFetch(API_ENDPOINTS.apiKey.store, {
      method: 'POST',
      body: { apiKey }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to store API key');
    }
  } catch (error) {
    console.error('Error updating API key:', error);
    throw new Error('Failed to securely store API key');
  }
};

/**
 * Check if user has API key stored (server-side)
 */
export const hasUserApiKey = async (userId: string, keyType: 'google' | 'fal' = 'google'): Promise<boolean> => {
  try {
    const response = await authFetch(`${API_ENDPOINTS.apiKey.check}?keyType=${keyType}`, { method: 'GET' });

    if (response.ok) {
      const data = await response.json();
      return data.hasApiKey || false;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking API key:', error);
    return false;
  }
};

/**
 * Record API usage with token tracking
 */
export const recordUsage = async (
  userId: string, 
  operation: UsageRecord['operation'], 
  cost: number, 
  success: boolean,
  tokenUsage?: TokenUsage,
  apiService: 'firebase' | 'custom' = 'firebase'
): Promise<void> => {
  try {
    // Record usage in usage collection
    const usageRef = doc(db, 'usage', `${userId}_${Date.now()}`);
    const usageRecord: any = {
      userId,
      operation,
      timestamp: new Date().toISOString(),
      cost,
      success,
      apiService,
    };
    
    // Only add tokenUsage if it's defined (Firestore doesn't allow undefined values)
    if (tokenUsage) {
      usageRecord.tokenUsage = tokenUsage;
    }
    
    await setDoc(usageRef, usageRecord);
    
    // Update user's total usage and free credits
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const userData = userSnap.data() as UserProfile;
      const newTotalUsage = userData.totalUsage + (success ? cost : 0);
      const newFreeCredits = Math.max(0, userData.freeCredits - (success ? cost : 0));
      
      await updateDoc(userRef, {
        totalUsage: newTotalUsage,
        freeCredits: newFreeCredits,
      });
    }
  } catch (error) {
    console.error('Error recording usage:', error);
    // Don't throw error to avoid breaking the main flow
  }
};

/**
 * Check if user has sufficient credits
 */
export const checkUserCredits = async (userId: string, requiredCredits: number): Promise<boolean> => {
  try {
    const userProfile = await getUserProfile(userId);
    if (!userProfile) return false;
    
    return userProfile.freeCredits >= requiredCredits;
  } catch (error) {
    console.error('Error checking credits:', error);
    
    // Check if it's a network blocking issue
    if (error instanceof Error && error.message.includes('ERR_BLOCKED_BY_CLIENT')) {
      throw new Error('Firestore requests are being blocked. Please disable your ad blocker for this site or add reelbanana.ai to your whitelist.');
    }
    
    return false;
  }
};

/**
 * Get user's usage statistics with token analytics
 */
export const getUserUsageStats = async (userId: string): Promise<{
  freeCredits: number;
  totalUsage: number;
  hasCustomApiKey: boolean;
  tokenAnalytics?: {
    totalTokens: number;
    totalCost: number;
    tokensByOperation: { [key: string]: number };
    costByOperation: { [key: string]: number };
    tokensByService: { [key: string]: number };
    costByService: { [key: string]: number };
  };
}> => {
  try {
    const userProfile = await getUserProfile(userId);
    if (!userProfile) {
      return { freeCredits: 0, totalUsage: 0, hasCustomApiKey: false };
    }
    
    // Check if user has API key stored server-side
    const hasApiKey = await hasUserApiKey(userId);
    
    // Get detailed usage records for token analytics
    const usageQuery = query(
      collection(db, 'usage'),
      where('userId', '==', userId),
      where('success', '==', true)
    );
    
    const usageSnapshot = await getDocs(usageQuery);
    const usageRecords = usageSnapshot.docs.map(doc => doc.data() as UsageRecord);

    // Calculate token analytics
    const tokenAnalytics = {
      totalTokens: 0,
      totalCost: 0,
      tokensByOperation: {} as { [key: string]: number },
      costByOperation: {} as { [key: string]: number },
      tokensByService: {} as { [key: string]: number },
      costByService: {} as { [key: string]: number },
    };

    usageRecords.forEach(record => {
      if (record.tokenUsage) {
        const tokens = record.tokenUsage.totalTokens;
        const cost = record.tokenUsage.estimatedCost;
        
        tokenAnalytics.totalTokens += tokens;
        tokenAnalytics.totalCost += cost;
        
        // By operation
        tokenAnalytics.tokensByOperation[record.operation] = 
          (tokenAnalytics.tokensByOperation[record.operation] || 0) + tokens;
        tokenAnalytics.costByOperation[record.operation] = 
          (tokenAnalytics.costByOperation[record.operation] || 0) + cost;
        
        // By service
        tokenAnalytics.tokensByService[record.apiService] = 
          (tokenAnalytics.tokensByService[record.apiService] || 0) + tokens;
        tokenAnalytics.costByService[record.apiService] = 
          (tokenAnalytics.costByService[record.apiService] || 0) + cost;
      }
    });
    
    return {
      freeCredits: userProfile.freeCredits,
      totalUsage: userProfile.totalUsage,
      hasCustomApiKey: hasApiKey,
      tokenAnalytics,
    };
  } catch (error) {
    console.error('Error getting usage stats:', error);
    return { freeCredits: 0, totalUsage: 0, hasCustomApiKey: false };
  }
};

