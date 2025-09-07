/**
 * Shared Health Check Utility for ReelBanana Services
 * Provides both public and protected health endpoints
 */

const admin = require('firebase-admin');

/**
 * App Check verification middleware for protected endpoints
 */
const appCheckVerification = async (req, res, next) => {
  const appCheckToken = req.header('X-Firebase-AppCheck');

  if (!appCheckToken) {
    return res.status(401).json({
      code: 'APP_CHECK_REQUIRED',
      message: 'App Check token required for protected endpoints',
      requestId: req.requestId
    });
  }

  try {
    const appCheckClaims = await admin.appCheck().verifyToken(appCheckToken);
    req.appCheckClaims = appCheckClaims;
    return next();
  } catch (err) {
    console.error('App Check verification failed:', err);
    return res.status(401).json({
      code: 'APP_CHECK_INVALID',
      message: 'Invalid App Check token',
      requestId: req.requestId
    });
  }
};

/**
 * Create basic health check endpoint (public)
 */
function createBasicHealthCheck(serviceName, additionalChecks = {}) {
  return (req, res) => {
    const health = {
      status: 'ok',
      service: serviceName,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      ...additionalChecks
    };
    
    res.json(health);
  };
}

/**
 * Create detailed health check endpoint (protected with App Check)
 */
function createDetailedHealthCheck(serviceName, detailedChecks = {}) {
  return async (req, res) => {
    try {
      const health = {
        status: 'ok',
        service: serviceName,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        appCheck: {
          verified: true,
          appId: req.appCheckClaims?.app_id || req.appCheckClaims?.appId,
          issuedAt: req.appCheckClaims?.iat,
          expiresAt: req.appCheckClaims?.exp
        },
        ...detailedChecks
      };
      
      res.json(health);
    } catch (error) {
      console.error('Detailed health check error:', error);
      res.status(500).json({
        status: 'error',
        service: serviceName,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  };
}

/**
 * Create health check endpoints for a service
 */
function createHealthEndpoints(app, serviceName, basicChecks = {}, detailedChecks = {}) {
  // Public health endpoint (for load balancers, monitoring)
  app.get('/health', createBasicHealthCheck(serviceName, basicChecks));
  
  // Protected detailed health endpoint (for admin/monitoring tools)
  app.get('/health/detailed', appCheckVerification, createDetailedHealthCheck(serviceName, detailedChecks));
  
  // Protected service status endpoint (for internal monitoring)
  app.get('/status', appCheckVerification, async (req, res) => {
    try {
      const status = {
        service: serviceName,
        status: 'operational',
        timestamp: new Date().toISOString(),
        metrics: {
          requests: req.serviceMetrics?.requests || 0,
          errors: req.serviceMetrics?.errors || 0,
          avgResponseTime: req.serviceMetrics?.avgResponseTime || 0
        },
        dependencies: detailedChecks.dependencies || {},
        requestId: req.requestId
      };
      
      res.json(status);
    } catch (error) {
      res.status(500).json({
        service: serviceName,
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
}

/**
 * Service dependency health checker
 */
class DependencyHealthChecker {
  constructor() {
    this.dependencies = new Map();
  }
  
  addDependency(name, checkFunction) {
    this.dependencies.set(name, checkFunction);
  }
  
  async checkAll() {
    const results = {};
    
    for (const [name, checkFunction] of this.dependencies) {
      try {
        const result = await checkFunction();
        results[name] = {
          status: 'healthy',
          ...result
        };
      } catch (error) {
        results[name] = {
          status: 'unhealthy',
          error: error.message
        };
      }
    }
    
    return results;
  }
}

/**
 * Common dependency checks
 */
const commonDependencyChecks = {
  firebase: async () => {
    try {
      // Check if Firebase Admin is initialized
      if (!admin.apps.length) {
        throw new Error('Firebase Admin not initialized');
      }
      return { message: 'Firebase Admin initialized' };
    } catch (error) {
      throw new Error(`Firebase check failed: ${error.message}`);
    }
  },
  
  gcs: async (bucketName) => {
    try {
      const { Storage } = require('@google-cloud/storage');
      const storage = new Storage();
      const bucket = storage.bucket(bucketName);
      
      // Try to get bucket metadata
      const [metadata] = await bucket.getMetadata();
      return { 
        message: 'GCS bucket accessible',
        bucket: bucketName,
        location: metadata.location
      };
    } catch (error) {
      throw new Error(`GCS check failed: ${error.message}`);
    }
  },
  
  elevenlabs: async () => {
    try {
      const apiKey = process.env.ELEVENLABS_MUSIC_API_KEY || process.env.ELEVENLABS_API_KEY;
      if (!apiKey) {
        throw new Error('ElevenLabs API key not configured');
      }
      return { message: 'ElevenLabs API key configured' };
    } catch (error) {
      throw new Error(`ElevenLabs check failed: ${error.message}`);
    }
  },
  
  gemini: async () => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('Gemini API key not configured');
      }
      return { message: 'Gemini API key configured' };
    } catch (error) {
      throw new Error(`Gemini check failed: ${error.message}`);
    }
  }
};

module.exports = {
  appCheckVerification,
  createBasicHealthCheck,
  createDetailedHealthCheck,
  createHealthEndpoints,
  DependencyHealthChecker,
  commonDependencyChecks
};
