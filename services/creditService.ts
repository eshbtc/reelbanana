// Credit management service for ReelBanana
import { getFirestore, collection, doc, getDoc, setDoc, updateDoc, runTransaction, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { firebaseApp } from '../lib/firebase';

const db = getFirestore(firebaseApp);
import { getCurrentUser } from './authService';
import { OPERATION_COSTS, validateCredits, getOperationCost } from '../utils/costCalculator';
import { API_ENDPOINTS, apiCall } from '../config/apiConfig';
import { purchaseCreditsApi, type PurchaseCreditsResponse } from './billingService';
import { handleBillingError, retryOperation, getUserErrorMessage } from './billingErrorHandler';

// Types for credit operations
export interface UsageEvent {
  id: string; // unique idempotency key
  userId: string;
  operation: 'story' | 'image' | 'narration' | 'video' | 'polish' | 'music';
  creditsUsed: number;
  timestamp: Date;
  status: 'pending' | 'completed' | 'failed';
  metadata?: {
    sceneId?: string;
    projectId?: string;
    operationDetails?: any;
  };
}

export interface CreditTransaction {
  id: string;
  userId: string;
  type: 'purchase' | 'usage' | 'refund' | 'bonus';
  amount: number; // positive for credits added, negative for credits used
  description: string;
  timestamp: Date;
  metadata?: any;
}

export interface CreditBalance {
  total: number;
  available: number;
  pending: number; // credits reserved for ongoing operations
  lastUpdated: Date;
}

/**
 * Generate a unique idempotency key for credit operations
 */
export const generateIdempotencyKey = (userId: string, operation: string, params?: any): string => {
  const timestamp = Date.now();
  const paramsHash = params ? btoa(JSON.stringify(params)).slice(0, 8) : '';
  return `${userId}-${operation}-${timestamp}-${paramsHash}`;
};

/**
 * Check if an operation has already been processed (idempotency check)
 */
export const checkOperationExists = async (idempotencyKey: string): Promise<UsageEvent | null> => {
  try {
    const docRef = doc(db, 'usage_events', idempotencyKey);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as UsageEvent) : null;
  } catch (error) {
    console.error('Error checking operation existence:', error);
    return null;
  }
};

/**
 * Reserve credits for an operation (idempotent)
 */
export const reserveCredits = async (
  operation: keyof typeof OPERATION_COSTS,
  params?: any,
  metadata?: any
): Promise<{ success: boolean; idempotencyKey: string; creditsReserved: number; error?: string }> => {
  const user = getCurrentUser();
  if (!user) {
    return { success: false, idempotencyKey: '', creditsReserved: 0, error: 'User not authenticated' };
  }

  const idempotencyKey = generateIdempotencyKey(user.uid, operation, params);
  
  try {
    // Check if operation already exists
    const existingOperation = await checkOperationExists(idempotencyKey);
    if (existingOperation) {
      return {
        success: true,
        idempotencyKey,
        creditsReserved: existingOperation.creditsUsed,
      };
    }

    // Calculate required credits
    const requiredCredits = getOperationCost(operation, params);
    
    // Get user's current credit balance
    const userDocRef = doc(db, 'users', user.uid);
    const userDocSnap = await getDoc(userDocRef);
    const userData = userDocSnap.data();
    const currentCredits = userData?.freeCredits || 0;
    const isAdmin = userData?.isAdmin || false;

    // Validate credits
    const validation = validateCredits(currentCredits, requiredCredits, isAdmin);
    if (!validation.valid) {
      return {
        success: false,
        idempotencyKey,
        creditsReserved: 0,
        error: validation.reason,
      };
    }

    // Reserve credits in a transaction
    await runTransaction(db, async (transaction) => {
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await transaction.get(userRef);
      
      if (!userDoc.exists()) {
        throw new Error('User document not found');
      }

      const userData = userDoc.data()!;
      const availableCredits = userData.freeCredits || 0;
      
      if (!isAdmin && availableCredits < requiredCredits) {
        throw new Error('Insufficient credits');
      }

      // Update user credits
      transaction.update(userRef, {
        freeCredits: isAdmin ? availableCredits : availableCredits - requiredCredits,
        lastCreditUpdate: new Date(),
      });

      // Record usage event
      const usageEvent: UsageEvent = {
        id: idempotencyKey,
        userId: user.uid,
        operation: operation as any,
        creditsUsed: requiredCredits,
        timestamp: new Date(),
        status: 'pending',
        metadata,
      };

      transaction.set(doc(db, 'usage_events', idempotencyKey), usageEvent);
    });

    return {
      success: true,
      idempotencyKey,
      creditsReserved: requiredCredits,
    };

  } catch (error) {
    console.error('Error reserving credits:', error);
    const { userAction } = handleBillingError(error, {
      operation: 'reserveCredits',
      userId: user.uid,
      amount: getOperationCost(operation, params),
      timestamp: new Date(),
    });
    
    return {
      success: false,
      idempotencyKey,
      creditsReserved: 0,
      error: userAction,
    };
  }
};

/**
 * Complete a credit operation (mark as completed or failed)
 */
export const completeCreditOperation = async (
  idempotencyKey: string,
  status: 'completed' | 'failed',
  error?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const docRef = doc(db, 'usage_events', idempotencyKey);
    await updateDoc(docRef, {
      status,
      completedAt: new Date(),
      error: error || null,
    });

    return { success: true };
  } catch (error) {
    console.error('Error completing credit operation:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * Refund credits for a failed operation
 */
export const refundCredits = async (
  idempotencyKey: string,
  reason: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const usageEventDocRef = doc(db, 'usage_events', idempotencyKey);
    const usageEventDocSnap = await getDoc(usageEventDocRef);
    if (!usageEventDocSnap.exists()) {
      return { success: false, error: 'Usage event not found' };
    }

    const usageEvent = usageEventDocSnap.data() as UsageEvent;
    
    if (usageEvent.status === 'completed') {
      return { success: false, error: 'Operation already completed, cannot refund' };
    }

    await runTransaction(db, async (transaction) => {
      const userRef = doc(db, 'users', usageEvent.userId);
      const userDoc = await transaction.get(userRef);
      
      if (!userDoc.exists()) {
        throw new Error('User document not found');
      }

      const userData = userDoc.data()!;
      const isAdmin = userData.isAdmin || false;
      
      // Only refund if not admin (admins don't pay credits)
      if (!isAdmin) {
        transaction.update(userRef, {
          freeCredits: (userData.freeCredits || 0) + usageEvent.creditsUsed,
          lastCreditUpdate: new Date(),
        });
      }

      // Update usage event
      transaction.update(usageEventDocRef, {
        status: 'failed',
        refunded: true,
        refundReason: reason,
        refundedAt: new Date(),
      });
    });

    return { success: true };
  } catch (error) {
    console.error('Error refunding credits:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * Get user's credit balance
 */
export const getCreditBalance = async (userId?: string): Promise<CreditBalance> => {
  const user = userId ? { uid: userId } : getCurrentUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  try {
    const userDocRef = doc(db, 'users', user.uid);
    const userDocSnap = await getDoc(userDocRef);
    if (!userDocSnap.exists()) {
      return {
        total: 0,
        available: 0,
        pending: 0,
        lastUpdated: new Date(),
      };
    }

    const userData = userDocSnap.data()!;
    const total = userData.freeCredits || 0;
    
    // Calculate pending credits (operations in progress)
    const pendingQuery = query(
      collection(db, 'usage_events'),
      where('userId', '==', user.uid),
      where('status', '==', 'pending')
    );
    
    const pendingQuerySnap = await getDocs(pendingQuery);
    const pending = pendingQuerySnap.docs.reduce((sum, doc) => {
      const event = doc.data() as UsageEvent;
      return sum + event.creditsUsed;
    }, 0);

    return {
      total,
      available: total - pending,
      pending,
      lastUpdated: new Date(),
    };
  } catch (error) {
    console.error('Error getting credit balance:', error);
    throw new Error('Failed to get credit balance');
  }
};

/**
 * Purchase credits using Stripe
 */
export const purchaseCredits = async (
  packageId: string,
  paymentMethodId: string
): Promise<PurchaseCreditsResponse> => {
  try {
    const response = await retryOperation(async () => {
      return await purchaseCreditsApi({ packageId, paymentMethodId });
    }, 3, 1000);

    // Update user's credit balance
    if (response.success) {
      const user = getCurrentUser();
      if (user) {
        // Refresh user profile to get updated credits
        const userDocRef = doc(db, 'users', user.uid);
        await updateDoc(userDocRef, {
          lastCreditUpdate: new Date(),
        });
      }
    }

    return response;
  } catch (error) {
    console.error('Error purchasing credits:', error);
    const { userAction } = handleBillingError(error, {
      operation: 'purchaseCredits',
      amount: 0, // We don't know the amount here
      timestamp: new Date(),
    });
    
    return {
      success: false,
      error: userAction,
    };
  }
};

/**
 * Get user's credit transaction history
 */
export const getCreditHistory = async (
  userId?: string,
  limitCount: number = 50
): Promise<CreditTransaction[]> => {
  const user = userId ? { uid: userId } : getCurrentUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  try {
    const transactionsQuery = query(
      collection(db, 'credit_transactions'),
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );

    const transactionsQuerySnap = await getDocs(transactionsQuery);
    return transactionsQuerySnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate() || new Date(),
    } as CreditTransaction));
  } catch (error) {
    console.error('Error getting credit history:', error);
    throw new Error('Failed to get credit history');
  }
};

/**
 * Add bonus credits (for promotions, referrals, etc.)
 */
export const addBonusCredits = async (
  userId: string,
  credits: number,
  reason: string,
  metadata?: any
): Promise<{ success: boolean; error?: string }> => {
  try {
    await runTransaction(db, async (transaction) => {
      const userRef = doc(db, 'users', userId);
      const userDoc = await transaction.get(userRef);
      
      if (!userDoc.exists()) {
        throw new Error('User document not found');
      }

      const userData = userDoc.data()!;
      
      // Add credits to user
      transaction.update(userRef, {
        freeCredits: (userData.freeCredits || 0) + credits,
        lastCreditUpdate: new Date(),
      });

      // Record transaction
      const transactionRef = doc(collection(db, 'credit_transactions'));
      transaction.set(transactionRef, {
        userId,
        type: 'bonus',
        amount: credits,
        description: reason,
        timestamp: new Date(),
        metadata,
      });
    });

    return { success: true };
  } catch (error) {
    console.error('Error adding bonus credits:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};
