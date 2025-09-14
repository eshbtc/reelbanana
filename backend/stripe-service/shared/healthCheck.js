// Health check utilities for Stripe service
const admin = require('firebase-admin');

function createHealthEndpoints(app, serviceName) {
  // Basic health check
  app.get('/health', async (req, res) => {
    try {
      const health = {
        status: 'healthy',
        service: serviceName,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0'
      };

      // Check Stripe connection
      if (global.stripe) {
        health.stripe = 'connected';
      } else {
        health.stripe = 'disconnected';
        health.status = 'degraded';
      }

      // Check Firebase connection
      try {
        await admin.firestore().collection('health').doc('test').get();
        health.firebase = 'connected';
      } catch (error) {
        health.firebase = 'disconnected';
        health.status = 'unhealthy';
      }

      const statusCode = health.status === 'healthy' ? 200 : 
                        health.status === 'degraded' ? 200 : 503;
      
      res.status(statusCode).json(health);
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        service: serviceName,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Detailed health check
  app.get('/health/detailed', async (req, res) => {
    try {
      const health = {
        status: 'healthy',
        service: serviceName,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.npm_package_version || '1.0.0',
        dependencies: {}
      };

      // Check Stripe
      if (global.stripe) {
        try {
          await global.stripe.balance.retrieve();
          health.dependencies.stripe = { status: 'healthy', latency: Date.now() };
        } catch (error) {
          health.dependencies.stripe = { status: 'unhealthy', error: error.message };
          health.status = 'degraded';
        }
      } else {
        health.dependencies.stripe = { status: 'disconnected' };
        health.status = 'degraded';
      }

      // Check Firebase
      try {
        const start = Date.now();
        await admin.firestore().collection('health').doc('test').get();
        health.dependencies.firebase = { 
          status: 'healthy', 
          latency: Date.now() - start 
        };
      } catch (error) {
        health.dependencies.firebase = { status: 'unhealthy', error: error.message };
        health.status = 'unhealthy';
      }

      const statusCode = health.status === 'healthy' ? 200 : 
                        health.status === 'degraded' ? 200 : 503;
      
      res.status(statusCode).json(health);
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        service: serviceName,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
}

module.exports = {
  createHealthEndpoints
};

