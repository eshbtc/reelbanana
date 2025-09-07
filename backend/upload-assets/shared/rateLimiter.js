/**
 * Shared Rate Limiting Utility for ReelBanana Services
 * Provides per-user and per-IP rate limiting with quota tracking
 */

const rateLimit = require('express-rate-limit');
const admin = require('firebase-admin');

// In-memory store for user quotas (in production, use Redis or Firestore)
const userQuotas = new Map();
const quotaResetInterval = 24 * 60 * 60 * 1000; // 24 hours

// Clean up expired quotas periodically
setInterval(() => {
  const now = Date.now();
  for (const [userId, quota] of userQuotas.entries()) {
    if (now - quota.resetTime > quotaResetInterval) {
      userQuotas.delete(userId);
    }
  }
}, 60 * 60 * 1000); // Clean up every hour

/**
 * Get user quota limits based on user type/plan
 * In production, this would fetch the user's actual plan from Firestore
 */
async function getUserQuotaLimits(userId, userPlan = null) {
  // If no plan provided, try to fetch from Firestore
  if (!userPlan && userId) {
    try {
      const admin = require('firebase-admin');
      const db = admin.firestore();
      const userDoc = await db.collection('users').doc(userId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        userPlan = userData.plan || userData.subscription?.plan || 'free';
      } else {
        userPlan = 'free'; // Default for new users
      }
    } catch (error) {
      console.warn('Failed to fetch user plan, defaulting to free:', error.message);
      userPlan = 'free';
    }
  }
  
  // Fallback to free if still no plan
  userPlan = userPlan || 'free';
  const quotas = {
    free: {
      narrate: { daily: 10, hourly: 3 },
      align: { daily: 10, hourly: 3 },
      compose: { daily: 5, hourly: 2 },
      render: { daily: 5, hourly: 2 },
      polish: { daily: 2, hourly: 1 },
      upload: { daily: 50, hourly: 10 }
    },
    pro: {
      narrate: { daily: 100, hourly: 20 },
      align: { daily: 100, hourly: 20 },
      compose: { daily: 50, hourly: 10 },
      render: { daily: 50, hourly: 10 },
      polish: { daily: 20, hourly: 5 },
      upload: { daily: 500, hourly: 50 }
    },
    enterprise: {
      narrate: { daily: 1000, hourly: 100 },
      align: { daily: 1000, hourly: 100 },
      compose: { daily: 500, hourly: 50 },
      render: { daily: 500, hourly: 50 },
      polish: { daily: 200, hourly: 20 },
      upload: { daily: 5000, hourly: 500 }
    }
  };
  
  return quotas[userPlan] || quotas.free;
}

/**
 * Check if user has exceeded quota for a specific operation
 */
async function checkUserQuota(userId, operation) {
  if (!userId) return { allowed: true, remaining: 0 };
  
  const now = Date.now();
  const userQuota = userQuotas.get(userId) || {
    resetTime: now,
    operations: {}
  };
  
  // Reset daily quotas if needed
  if (now - userQuota.resetTime > quotaResetInterval) {
    userQuota.resetTime = now;
    userQuota.operations = {};
  }
  
  // Get user's quota limits (fetch from user profile)
  const limits = await getUserQuotaLimits(userId);
  const operationLimits = limits[operation];
  
  if (!operationLimits) {
    return { allowed: true, remaining: 0 };
  }
  
  const operationQuota = userQuota.operations[operation] || {
    daily: 0,
    hourly: 0,
    lastHourReset: now
  };
  
  // Reset hourly quota if needed
  if (now - operationQuota.lastHourReset > 60 * 60 * 1000) {
    operationQuota.hourly = 0;
    operationQuota.lastHourReset = now;
  }
  
  // Check quotas
  const dailyExceeded = operationQuota.daily >= operationLimits.daily;
  const hourlyExceeded = operationQuota.hourly >= operationLimits.hourly;
  
  if (dailyExceeded || hourlyExceeded) {
    const resetTime = dailyExceeded ? 
      userQuota.resetTime + quotaResetInterval : 
      operationQuota.lastHourReset + (60 * 60 * 1000);
    
    return {
      allowed: false,
      remaining: 0,
      resetTime,
      limit: dailyExceeded ? 'daily' : 'hourly',
      limitValue: dailyExceeded ? operationLimits.daily : operationLimits.hourly
    };
  }
  
  // Update quotas
  operationQuota.daily++;
  operationQuota.hourly++;
  userQuota.operations[operation] = operationQuota;
  userQuotas.set(userId, userQuota);
  
  return {
    allowed: true,
    remaining: Math.min(
      operationLimits.daily - operationQuota.daily,
      operationLimits.hourly - operationQuota.hourly
    )
  };
}

/**
 * Create rate limiter middleware for specific operations
 */
function createOperationRateLimiter(operation, options = {}) {
  return async (req, res, next) => {
    try {
      // Extract user ID from Firebase token
      let userId = null;
      if (req.user && req.user.uid) {
        userId = req.user.uid;
      }
      
      // Check user quota
      const quotaCheck = await checkUserQuota(userId, operation);
      
      if (!quotaCheck.allowed) {
        const resetTime = new Date(quotaCheck.resetTime).toISOString();
        return res.status(429).json({
          code: 'QUOTA_EXCEEDED',
          message: `${operation} quota exceeded (${quotaCheck.limit})`,
          details: {
            operation,
            limit: quotaCheck.limit,
            limitValue: quotaCheck.limitValue,
            resetTime,
            requestId: req.requestId
          }
        });
      }
      
      // Add quota info to response headers
      res.setHeader('X-Quota-Remaining', quotaCheck.remaining);
      res.setHeader('X-Quota-Operation', operation);
      
      next();
    } catch (error) {
      console.error('Rate limiter error:', error);
      // Allow request to proceed if rate limiter fails
      next();
    }
  };
}

/**
 * Create IP-based rate limiter for anonymous users
 */
function createIPRateLimiter(options = {}) {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 50, // requests per window
    message = 'Too many requests from this IP'
  } = options;
  
  return rateLimit({
    windowMs,
    max,
    message: {
      code: 'RATE_LIMIT_EXCEEDED',
      message,
      details: {
        windowMs,
        max,
        requestId: null // Will be set by request middleware
      }
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      const payload = {
        code: 'RATE_LIMIT_EXCEEDED',
        message,
        details: {
          windowMs,
          max,
          requestId: req.requestId
        }
      };
      res.status(429).json(payload);
    }
  });
}

/**
 * Create comprehensive rate limiter for expensive operations
 */
function createExpensiveOperationLimiter(operation) {
  return [
    // IP-based limiting for anonymous users
    createIPRateLimiter({
      windowMs: 15 * 60 * 1000,
      max: 10, // More restrictive for expensive operations
      message: `Too many ${operation} requests from this IP`
    }),
    // User-based quota limiting
    createOperationRateLimiter(operation)
  ];
}

/**
 * Get quota status for a user (for dashboard/UI)
 */
async function getUserQuotaStatus(userId) {
  if (!userId) return null;
  
  const userQuota = userQuotas.get(userId);
  if (!userQuota) return null;
  
  const limits = await getUserQuotaLimits(userId);
  const status = {};
  
  for (const [operation, operationLimits] of Object.entries(limits)) {
    const operationQuota = userQuota.operations[operation] || { daily: 0, hourly: 0 };
    status[operation] = {
      daily: {
        used: operationQuota.daily,
        limit: operationLimits.daily,
        remaining: operationLimits.daily - operationQuota.daily
      },
      hourly: {
        used: operationQuota.hourly,
        limit: operationLimits.hourly,
        remaining: operationLimits.hourly - operationQuota.hourly
      }
    };
  }
  
  return status;
}

module.exports = {
  createOperationRateLimiter,
  createIPRateLimiter,
  createExpensiveOperationLimiter,
  getUserQuotaStatus,
  checkUserQuota,
  getUserQuotaLimits
};
