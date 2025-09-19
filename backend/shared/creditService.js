const admin = require('firebase-admin');

/**
 * Shared credit service for backend microservices
 * Handles credit validation and deduction across all services
 */

/**
 * Check if user has enough credits for an operation
 */
async function checkUserCredits(userId, operation, params = {}) {
  try {
    if (!userId) {
      return { hasCredits: false, error: 'User not authenticated' };
    }

    // Get user profile
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return { hasCredits: false, error: 'User not found' };
    }

    const userData = userDoc.data();
    const isAdmin = userData.isAdmin || false;
    
    // Admins bypass credit checks
    if (isAdmin) {
      return { hasCredits: true, isAdmin: true, credits: 999999 };
    }

    const currentCredits = userData.freeCredits || 0;
    
    // Calculate required credits based on operation
    const requiredCredits = getOperationCost(operation, params);
    
    if (currentCredits < requiredCredits) {
      return { 
        hasCredits: false, 
        error: 'Insufficient credits',
        required: requiredCredits,
        available: currentCredits
      };
    }

    return { 
      hasCredits: true, 
      isAdmin: false, 
      credits: currentCredits,
      required: requiredCredits
    };
  } catch (error) {
    console.error('Error checking user credits:', error);
    return { hasCredits: false, error: 'Failed to check credits' };
  }
}

/**
 * Deduct credits from user account
 */
async function deductCredits(userId, operation, params = {}, idempotencyKey = null) {
  try {
    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }

    // Generate idempotency key if not provided
    if (!idempotencyKey) {
      idempotencyKey = `${userId}-${operation}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    // Check if operation already exists (idempotency)
    const existingOp = await admin.firestore()
      .collection('usage_events')
      .doc(idempotencyKey)
      .get();
    
    if (existingOp.exists) {
      return { 
        success: true, 
        idempotencyKey,
        message: 'Operation already processed'
      };
    }

    const requiredCredits = getOperationCost(operation, params);
    
    // Use transaction to ensure atomicity
    await admin.firestore().runTransaction(async (transaction) => {
      const userRef = admin.firestore().collection('users').doc(userId);
      const userDoc = await transaction.get(userRef);
      
      if (!userDoc.exists) {
        throw new Error('User document not found');
      }

      const userData = userDoc.data();
      const isAdmin = userData.isAdmin || false;
      const currentCredits = userData.freeCredits || 0;
      
      // Only deduct credits if not admin
      if (!isAdmin) {
        if (currentCredits < requiredCredits) {
          throw new Error('Insufficient credits');
        }
        
        transaction.update(userRef, {
          freeCredits: currentCredits - requiredCredits,
          lastCreditUpdate: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      // Record usage event
      const usageEvent = {
        id: idempotencyKey,
        userId,
        operation,
        creditsUsed: requiredCredits,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        status: 'pending',
        metadata: params
      };

      transaction.set(
        admin.firestore().collection('usage_events').doc(idempotencyKey),
        usageEvent
      );
    });

    return { 
      success: true, 
      idempotencyKey,
      creditsDeducted: requiredCredits
    };
  } catch (error) {
    console.error('Error deducting credits:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to deduct credits'
    };
  }
}

/**
 * Complete a credit operation (mark as completed or failed)
 */
async function completeCreditOperation(idempotencyKey, status, error = null) {
  try {
    const docRef = admin.firestore().collection('usage_events').doc(idempotencyKey);
    await docRef.update({
      status,
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      error: error || null
    });

    return { success: true };
  } catch (error) {
    console.error('Error completing credit operation:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to complete operation'
    };
  }
}

/**
 * Get operation cost in credits
 */
function getOperationCost(operation, params = {}) {
  const costs = {
    'storyGeneration': 2,
    'imageGeneration': 3,
    'narration': 1,
    'videoRendering': 5,
    'proPolish': 10,
    'musicGeneration': 2,
    'alignCaptions': 1,
    'uploadAsset': 0, // Free operation
    'videoEnhancement': 8 // Video-to-video AI transformations
  };

  let baseCost = costs[operation] || 1;
  
  // Adjust cost based on parameters
  if (operation === 'imageGeneration' && params.imageCount) {
    baseCost = baseCost * params.imageCount;
  }
  
  if (operation === 'narration' && params.textLength) {
    baseCost = Math.ceil(params.textLength / 100); // 1 credit per 100 characters
  }

  return baseCost;
}

/**
 * Middleware to check credits before processing
 */
function requireCredits(operation, getParams = null) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.uid;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const params = getParams ? getParams(req) : {};
      const creditCheck = await checkUserCredits(userId, operation, params);
      
      if (!creditCheck.hasCredits) {
        return res.status(402).json({
          error: 'Insufficient credits',
          details: creditCheck.error,
          required: creditCheck.required,
          available: creditCheck.available
        });
      }

      // Store credit info in request for later use
      req.creditInfo = creditCheck;
      next();
    } catch (error) {
      console.error('Credit check middleware error:', error);
      res.status(500).json({ error: 'Credit check failed' });
    }
  };
}

/**
 * Middleware to deduct credits after successful operation
 */
function deductCreditsAfter(operation, getParams = null) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.uid;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const params = getParams ? getParams(req) : {};
      const idempotencyKey = req.headers['x-idempotency-key'] || 
        `${userId}-${operation}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const deductResult = await deductCredits(userId, operation, params, idempotencyKey);
      
      if (!deductResult.success) {
        return res.status(402).json({
          error: 'Failed to deduct credits',
          details: deductResult.error
        });
      }

      // Store deduction info for completion
      req.creditDeduction = {
        idempotencyKey: deductResult.idempotencyKey,
        creditsDeducted: deductResult.creditsDeducted
      };

      next();
    } catch (error) {
      console.error('Credit deduction middleware error:', error);
      res.status(500).json({ error: 'Credit deduction failed' });
    }
  };
}

module.exports = {
  checkUserCredits,
  deductCredits,
  completeCreditOperation,
  getOperationCost,
  requireCredits,
  deductCreditsAfter
};
