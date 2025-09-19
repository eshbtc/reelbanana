/**
 * SLI (Service Level Indicator) Monitoring System for ReelBanana
 * Tracks key performance metrics and success rates
 */

const admin = require('firebase-admin');

/**
 * SLI Metrics Store
 * In production, this would be backed by a time-series database like InfluxDB or Cloud Monitoring
 */
class SLIMetricsStore {
  constructor() {
    this.metrics = new Map();
    this.retentionHours = 24; // Keep 24 hours of data
    this.cleanupInterval = 60 * 60 * 1000; // Clean up every hour
    
    // Start cleanup timer
    setInterval(() => this.cleanup(), this.cleanupInterval);
  }
  
  record(metricName, value, labels = {}) {
    const timestamp = Date.now();
    const key = `${metricName}:${JSON.stringify(labels)}`;
    
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }
    
    const metricData = this.metrics.get(key);
    metricData.push({ timestamp, value, labels });
    
    // Keep only recent data
    const cutoff = timestamp - (this.retentionHours * 60 * 60 * 1000);
    this.metrics.set(key, metricData.filter(d => d.timestamp > cutoff));
  }
  
  getMetric(metricName, labels = {}, timeWindowMs = 24 * 60 * 60 * 1000) {
    const key = `${metricName}:${JSON.stringify(labels)}`;
    const data = this.metrics.get(key) || [];
    
    const cutoff = Date.now() - timeWindowMs;
    return data.filter(d => d.timestamp > cutoff);
  }
  
  cleanup() {
    const cutoff = Date.now() - (this.retentionHours * 60 * 60 * 1000);
    
    for (const [key, data] of this.metrics.entries()) {
      const filtered = data.filter(d => d.timestamp > cutoff);
      if (filtered.length === 0) {
        this.metrics.delete(key);
      } else {
        this.metrics.set(key, filtered);
      }
    }
  }
  
  getAllMetrics() {
    const result = {};
    for (const [key, data] of this.metrics.entries()) {
      result[key] = data;
    }
    return result;
  }
}

// Global metrics store
const metricsStore = new SLIMetricsStore();

/**
 * SLI Definitions
 */
const SLI_DEFINITIONS = {
  // Render Service SLIs
  render_success_rate: {
    name: 'render_success_rate',
    description: 'Percentage of successful video renders',
    target: 0.95, // 95% success rate
    window: 24 * 60 * 60 * 1000, // 24 hours
    calculate: (data) => {
      if (data.length === 0) return 0;
      const successful = data.filter(d => d.value === 1).length;
      return successful / data.length;
    }
  },
  
  render_95p_latency: {
    name: 'render_95p_latency',
    description: '95th percentile render time in milliseconds',
    target: 5 * 60 * 1000, // 5 minutes
    window: 24 * 60 * 60 * 1000, // 24 hours
    calculate: (data) => {
      if (data.length === 0) return 0;
      const sorted = data.map(d => d.value).sort((a, b) => a - b);
      const index = Math.ceil(sorted.length * 0.95) - 1;
      return sorted[index] || 0;
    }
  },
  
  playback_24h_success: {
    name: 'playback_24h_success',
    description: 'Percentage of videos that play successfully after 24 hours',
    target: 0.99, // 99% playback success
    window: 24 * 60 * 60 * 1000, // 24 hours
    calculate: (data) => {
      if (data.length === 0) return 0;
      const successful = data.filter(d => d.value === 1).length;
      return successful / data.length;
    }
  },
  
  // General Service SLIs
  service_availability: {
    name: 'service_availability',
    description: 'Service uptime percentage',
    target: 0.999, // 99.9% uptime
    window: 24 * 60 * 60 * 1000, // 24 hours
    calculate: (data) => {
      if (data.length === 0) return 0;
      const uptime = data.filter(d => d.value === 1).length;
      return uptime / data.length;
    }
  },
  
  error_rate: {
    name: 'error_rate',
    description: 'Percentage of requests that result in errors',
    target: 0.01, // 1% error rate
    window: 24 * 60 * 60 * 1000, // 24 hours
    calculate: (data) => {
      if (data.length === 0) return 0;
      const errors = data.filter(d => d.value === 1).length;
      return errors / data.length;
    }
  }
};

/**
 * SLI Monitor Class
 */
class SLIMonitor {
  constructor(serviceName) {
    this.serviceName = serviceName;
    this.startTime = Date.now();
  }
  
  /**
   * Record a metric value
   */
  record(metricName, value, labels = {}) {
    const fullLabels = { service: this.serviceName, ...labels };
    metricsStore.record(metricName, value, fullLabels);
  }
  
  /**
   * Record a success/failure
   */
  recordSuccess(operation, success = true, labels = {}) {
    this.record(`${operation}_success`, success ? 1 : 0, labels);
  }
  
  /**
   * Record latency
   */
  recordLatency(operation, latencyMs, labels = {}) {
    this.record(`${operation}_latency`, latencyMs, labels);
  }
  
  /**
   * Record error
   */
  recordError(operation, errorType, labels = {}) {
    this.record(`${operation}_error`, 1, { errorType, ...labels });
  }
  
  /**
   * Get SLI value for a specific metric
   */
  getSLI(metricName, labels = {}, timeWindowMs = null) {
    const sliDef = SLI_DEFINITIONS[metricName];
    if (!sliDef) {
      throw new Error(`Unknown SLI: ${metricName}`);
    }
    
    const window = timeWindowMs || sliDef.window;
    const data = metricsStore.getMetric(metricName, { service: this.serviceName, ...labels }, window);
    return sliDef.calculate(data);
  }
  
  /**
   * Get all SLIs for this service
   */
  getAllSLIs(timeWindowMs = null) {
    const slis = {};
    
    for (const [name, definition] of Object.entries(SLI_DEFINITIONS)) {
      try {
        const value = this.getSLI(name, {}, timeWindowMs);
        const target = definition.target;
        const status = this.evaluateSLIStatus(value, target, definition);
        
        slis[name] = {
          value,
          target,
          status,
          description: definition.description,
          window: timeWindowMs || definition.window
        };
      } catch (error) {
        // Skip SLIs that don't apply to this service
        if (!error.message.includes('Unknown SLI')) {
          console.warn(`Failed to calculate SLI ${name}:`, error.message);
        }
      }
    }
    
    return slis;
  }
  
  /**
   * Evaluate SLI status (good, warning, critical)
   */
  evaluateSLIStatus(value, target, definition) {
    // For success rates and availability, higher is better
    if (definition.name.includes('success') || definition.name.includes('availability')) {
      if (value >= target) return 'good';
      if (value >= target * 0.9) return 'warning';
      return 'critical';
    }
    
    // For latency and error rates, lower is better
    if (value <= target) return 'good';
    if (value <= target * 1.5) return 'warning';
    return 'critical';
  }
  
  /**
   * Get service health summary
   */
  getHealthSummary() {
    const slis = this.getAllSLIs();
    const critical = Object.values(slis).filter(sli => sli.status === 'critical').length;
    const warning = Object.values(slis).filter(sli => sli.status === 'warning').length;
    const good = Object.values(slis).filter(sli => sli.status === 'good').length;
    
    let overallStatus = 'healthy';
    if (critical > 0) overallStatus = 'critical';
    else if (warning > 0) overallStatus = 'warning';
    
    return {
      service: this.serviceName,
      status: overallStatus,
      uptime: Date.now() - this.startTime,
      slis: {
        total: Object.keys(slis).length,
        good,
        warning,
        critical
      },
      metrics: slis
    };
  }
}

/**
 * Express middleware for automatic SLI tracking
 */
function createSLIMiddleware(serviceName) {
  const monitor = new SLIMonitor(serviceName);
  
  return (req, res, next) => {
    const startTime = Date.now();
    const operation = `${req.method.toLowerCase()}_${req.route?.path || req.path}`;
    
    // Track request start
    monitor.record('request_start', 1, { operation });
    
    // Override res.end to track completion
    const originalEnd = res.end;
    res.end = function(...args) {
      const duration = Date.now() - startTime;
      
      // Record latency
      monitor.recordLatency(operation, duration, {
        status: res.statusCode,
        method: req.method
      });
      
      // Record success/failure
      const success = res.statusCode < 400;
      monitor.recordSuccess(operation, success, {
        status: res.statusCode,
        method: req.method
      });
      
      // Record errors
      if (!success) {
        monitor.recordError(operation, `http_${res.statusCode}`, {
          method: req.method,
          path: req.path
        });
      }
      
      // Call original end
      originalEnd.apply(this, args);
    };
    
    // Attach monitor to request for manual tracking
    req.sliMonitor = monitor;
    
    next();
  };
}

/**
 * Get global SLI dashboard data
 */
function getGlobalSLIDashboard() {
  const services = new Set();
  const allMetrics = metricsStore.getAllMetrics();
  
  // Extract service names from metrics
  for (const key of allMetrics.keys()) {
    const data = allMetrics.get(key);
    if (data.length > 0) {
      const service = data[0].labels?.service;
      if (service) services.add(service);
    }
  }
  
  const dashboard = {
    timestamp: new Date().toISOString(),
    services: {},
    global: {
      totalRequests: 0,
      totalErrors: 0,
      avgLatency: 0
    }
  };
  
  // Calculate per-service SLIs
  for (const serviceName of services) {
    const monitor = new SLIMonitor(serviceName);
    dashboard.services[serviceName] = monitor.getHealthSummary();
  }
  
  // Calculate global metrics
  const allRequestData = metricsStore.getMetric('request_start', {}, 24 * 60 * 60 * 1000);
  const allErrorData = metricsStore.getMetric('error', {}, 24 * 60 * 60 * 1000);
  const allLatencyData = metricsStore.getMetric('latency', {}, 24 * 60 * 60 * 1000);
  
  dashboard.global.totalRequests = allRequestData.length;
  dashboard.global.totalErrors = allErrorData.length;
  
  if (allLatencyData.length > 0) {
    const totalLatency = allLatencyData.reduce((sum, d) => sum + d.value, 0);
    dashboard.global.avgLatency = totalLatency / allLatencyData.length;
  }
  
  return dashboard;
}

module.exports = {
  SLIMonitor,
  createSLIMiddleware,
  getGlobalSLIDashboard,
  SLI_DEFINITIONS,
  metricsStore
};
