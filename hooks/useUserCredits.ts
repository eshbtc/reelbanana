import { useState, useEffect, useCallback } from 'react';
import { getCurrentUser, getUserProfile, onAuthStateChange } from '../services/authService';

interface UserCredits {
  freeCredits: number;
  totalUsage: number;
  isLoading: boolean;
  error: string | null;
}

/**
 * Custom hook for managing user credits with real-time updates
 */
export const useUserCredits = () => {
  const [credits, setCredits] = useState<UserCredits>({
    freeCredits: 0,
    totalUsage: 0,
    isLoading: true,
    error: null,
  });

  const [user, setUser] = useState<any>(null);

  // Load user credits
  const loadCredits = useCallback(async (userId: string) => {
    try {
      setCredits(prev => ({ ...prev, isLoading: true, error: null }));
      
      const userProfile = await getUserProfile(userId);
      if (userProfile) {
        setCredits({
          freeCredits: userProfile.freeCredits,
          totalUsage: userProfile.totalUsage,
          isLoading: false,
          error: null,
        });
      } else {
        setCredits({
          freeCredits: 0,
          totalUsage: 0,
          isLoading: false,
          error: 'User profile not found',
        });
      }
    } catch (error) {
      console.error('Error loading user credits:', error);
      setCredits(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load credits',
      }));
    }
  }, []);

  // Refresh credits (useful after API operations)
  const refreshCredits = useCallback(async () => {
    const currentUser = getCurrentUser();
    if (currentUser) {
      await loadCredits(currentUser.uid);
    }
  }, [loadCredits]);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChange((firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        loadCredits(firebaseUser.uid);
      } else {
        setCredits({
          freeCredits: 0,
          totalUsage: 0,
          isLoading: false,
          error: null,
        });
      }
    });

    return () => unsubscribe();
  }, [loadCredits]);

  // Auto-refresh credits every 30 seconds when user is logged in
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      refreshCredits();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [user, refreshCredits]);

  return {
    ...credits,
    refreshCredits,
    user,
  };
};
