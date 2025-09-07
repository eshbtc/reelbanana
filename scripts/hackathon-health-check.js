#!/usr/bin/env node

/**
 * Hackathon Health Check Script
 * Verifies all services are healthy and ready for demo
 */

import https from 'https';
import http from 'http';

// Production service URLs
const SERVICES = {
  upload: 'https://reel-banana-upload-assets-223097908182.us-central1.run.app',
  narrate: 'https://reel-banana-narrate-223097908182.us-central1.run.app',
  align: 'https://reel-banana-align-captions-223097908182.us-central1.run.app',
  render: 'https://reel-banana-render-223097908182.us-central1.run.app',
  compose: 'https://reel-banana-compose-music-223097908182.us-central1.run.app',
  polish: 'https://reel-banana-polish-223097908182.us-central1.run.app',
  apiKey: 'https://reel-banana-api-key-service-223097908182.us-central1.run.app'
};

async function checkServiceHealth(serviceName, baseUrl) {
  return new Promise((resolve) => {
    const url = `${baseUrl}/health`;
    const client = url.startsWith('https') ? https : http;
    
    const startTime = Date.now();
    
    const req = client.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const duration = Date.now() - startTime;
        try {
          const health = JSON.parse(data);
          resolve({
            service: serviceName,
            status: 'healthy',
            responseTime: duration,
            data: health
          });
        } catch (error) {
          resolve({
            service: serviceName,
            status: 'error',
            responseTime: duration,
            error: 'Invalid JSON response'
          });
        }
      });
    });
    
    req.on('error', (error) => {
      const duration = Date.now() - startTime;
      resolve({
        service: serviceName,
        status: 'error',
        responseTime: duration,
        error: error.message
      });
    });
    
    req.setTimeout(10000, () => {
      req.destroy();
      resolve({
        service: serviceName,
        status: 'timeout',
        responseTime: 10000,
        error: 'Request timeout'
      });
    });
  });
}

async function runHealthChecks() {
  console.log('🏥 Running Hackathon Health Checks...\n');
  
  const results = [];
  
  for (const [serviceName, baseUrl] of Object.entries(SERVICES)) {
    console.log(`Checking ${serviceName}...`);
    const result = await checkServiceHealth(serviceName, baseUrl);
    results.push(result);
    
    if (result.status === 'healthy') {
      console.log(`✅ ${serviceName}: ${result.responseTime}ms`);
    } else {
      console.log(`❌ ${serviceName}: ${result.error}`);
    }
  }
  
  console.log('\n📊 Health Check Summary:');
  console.log('========================');
  
  const healthy = results.filter(r => r.status === 'healthy');
  const unhealthy = results.filter(r => r.status !== 'healthy');
  
  console.log(`✅ Healthy: ${healthy.length}/${results.length}`);
  console.log(`❌ Unhealthy: ${unhealthy.length}/${results.length}`);
  
  if (unhealthy.length > 0) {
    console.log('\n🚨 Unhealthy Services:');
    unhealthy.forEach(service => {
      console.log(`  - ${service.service}: ${service.error}`);
    });
  }
  
  const avgResponseTime = healthy.reduce((sum, r) => sum + r.responseTime, 0) / healthy.length;
  console.log(`\n⚡ Average Response Time: ${Math.round(avgResponseTime)}ms`);
  
  // Check for critical services
  const criticalServices = ['render', 'narrate', 'compose'];
  const criticalHealthy = criticalServices.every(service => 
    results.find(r => r.service === service)?.status === 'healthy'
  );
  
  if (criticalHealthy) {
    console.log('\n🎉 All critical services are healthy! Ready for demo.');
  } else {
    console.log('\n⚠️  Some critical services are unhealthy. Check before demo.');
  }
  
  return results;
}

// Run health checks
if (import.meta.url === `file://${process.argv[1]}`) {
  runHealthChecks().catch(error => {
    console.error('Health check failed:', error);
    process.exit(1);
  });
}

export { runHealthChecks, checkServiceHealth };
