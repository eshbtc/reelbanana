import React, { useState, useEffect, useCallback } from 'react';
import { apiConfig, apiCall } from '../config/apiConfig';
import AdminAnalytics from './AdminAnalytics';

interface ServiceMetrics {
  service: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  requests: number;
  errors: number;
  avgResponseTime: number;
  lastChecked: string;
  dependencies?: any;
}

interface SystemStats {
  totalUsers: number;
  totalProjects: number;
  totalVideos: number;
  activeUsers: number;
  systemLoad: number;
  storageUsed: string;
  apiCallsToday: number;
  errorRate: number;
}

interface CacheStats {
  narrate: { hits: number; misses: number; size: string };
  align: { hits: number; misses: number; size: string };
  compose: { hits: number; misses: number; size: string };
  render: { hits: number; misses: number; size: string };
}

const AdminDashboard: React.FC = () => {
  const [services, setServices] = useState<ServiceMetrics[]>([]);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedService, setSelectedService] = useState<string | null>(null);

  const serviceUrls = [
    { key: 'upload', name: 'Upload Assets', url: `${apiConfig.baseUrls.upload}/health` },
    { key: 'narrate', name: 'Narrate (TTS)', url: `${apiConfig.baseUrls.narrate}/health` },
    { key: 'align', name: 'Align Captions', url: `${apiConfig.baseUrls.align}/health` },
    { key: 'render', name: 'Render', url: `${apiConfig.baseUrls.render}/health` },
    { key: 'compose', name: 'Compose Music', url: `${apiConfig.baseUrls.compose}/health` },
    { key: 'apiKey', name: 'API Key Service', url: `${apiConfig.baseUrls.apiKey}/health` },
  ];

  const fetchServiceMetrics = useCallback(async () => {
    try {
      const metrics = await Promise.allSettled(
        serviceUrls.map(async (service) => {
          try {
            const response = await fetch(service.url, {
              headers: {
                'X-Firebase-AppCheck': await getAppCheckToken(),
              },
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            return {
              service: service.name,
              status: data.status === 'ok' || data.status === 'healthy' ? 'healthy' : 'unhealthy',
              requests: data.metrics?.requests || 0,
              errors: data.metrics?.errors || 0,
              avgResponseTime: data.metrics?.avgResponseTime || 0,
              lastChecked: new Date().toISOString(),
              dependencies: data.dependencies,
            };
          } catch (error) {
            return {
              service: service.name,
              status: 'unhealthy' as const,
              requests: 0,
              errors: 1,
              avgResponseTime: 0,
              lastChecked: new Date().toISOString(),
              error: error.message,
            };
          }
        })
      );

      const results = metrics.map((result, index) => 
        result.status === 'fulfilled' ? result.value : {
          service: serviceUrls[index].name,
          status: 'unhealthy' as const,
          requests: 0,
          errors: 1,
          avgResponseTime: 0,
          lastChecked: new Date().toISOString(),
          error: result.reason?.message || 'Unknown error',
        }
      );

      setServices(results);
    } catch (error) {
      console.error('Failed to fetch service metrics:', error);
    }
  }, []);

  const fetchSystemStats = useCallback(async () => {
    try {
      // Mock system stats - in a real implementation, this would come from a dedicated admin API
      const mockStats: SystemStats = {
        totalUsers: Math.floor(Math.random() * 1000) + 500,
        totalProjects: Math.floor(Math.random() * 5000) + 2000,
        totalVideos: Math.floor(Math.random() * 10000) + 5000,
        activeUsers: Math.floor(Math.random() * 100) + 50,
        systemLoad: Math.random() * 100,
        storageUsed: `${(Math.random() * 100 + 50).toFixed(1)} GB`,
        apiCallsToday: Math.floor(Math.random() * 10000) + 5000,
        errorRate: Math.random() * 5,
      };
      setSystemStats(mockStats);
    } catch (error) {
      console.error('Failed to fetch system stats:', error);
    }
  }, []);

  const fetchCacheStats = useCallback(async () => {
    try {
      // Fetch cache stats from services that support it
      const cacheEndpoints = [
        { service: 'narrate', url: `${apiConfig.baseUrls.narrate}/cache-status` },
        { service: 'align', url: `${apiConfig.baseUrls.align}/cache-status` },
        { service: 'compose', url: `${apiConfig.baseUrls.compose}/cache-status` },
        { service: 'render', url: `${apiConfig.baseUrls.render}/cache-status` },
      ];

      const cacheResults = await Promise.allSettled(
        cacheEndpoints.map(async (endpoint) => {
          try {
            const response = await fetch(endpoint.url, {
              headers: {
                'X-Firebase-AppCheck': await getAppCheckToken(),
              },
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            return { service: endpoint.service, data };
          } catch (error) {
            return { service: endpoint.service, error: error.message };
          }
        })
      );

      const cacheStats: CacheStats = {
        narrate: { hits: 0, misses: 0, size: '0 MB' },
        align: { hits: 0, misses: 0, size: '0 MB' },
        compose: { hits: 0, misses: 0, size: '0 MB' },
        render: { hits: 0, misses: 0, size: '0 MB' },
      };

      cacheResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.data) {
          const service = result.value.service as keyof CacheStats;
          cacheStats[service] = {
            hits: result.value.data.hits || 0,
            misses: result.value.data.misses || 0,
            size: result.value.data.size || '0 MB',
          };
        }
      });

      setCacheStats(cacheStats);
    } catch (error) {
      console.error('Failed to fetch cache stats:', error);
    }
  }, []);

  const getAppCheckToken = async () => {
    try {
      const { getAppCheckToken } = await import('../lib/appCheck');
      return await getAppCheckToken();
    } catch {
      return null;
    }
  };

  const refreshAll = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([
      fetchServiceMetrics(),
      fetchSystemStats(),
      fetchCacheStats(),
    ]);
    setIsLoading(false);
  }, [fetchServiceMetrics, fetchSystemStats, fetchCacheStats]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(refreshAll, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [autoRefresh, refreshAll]);

  const clearCache = async (service: string) => {
    try {
      const serviceUrl = serviceUrls.find(s => s.name === service)?.url.replace('/status', '/cache-clear');
      if (!serviceUrl) return;

      await fetch(serviceUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Firebase-AppCheck': await getAppCheckToken(),
        },
        body: JSON.stringify({}),
      });

      await refreshAll();
    } catch (error) {
      console.error(`Failed to clear cache for ${service}:`, error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-400 bg-green-400/20';
      case 'unhealthy': return 'text-red-400 bg-red-400/20';
      default: return 'text-yellow-400 bg-yellow-400/20';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return '✅';
      case 'unhealthy': return '❌';
      default: return '⚠️';
    }
  };

  return (
    <div className="bg-gray-900 min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">🚀 Admin Dashboard</h1>
            <p className="text-gray-400">Real-time system monitoring and management</p>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-gray-300">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              Auto-refresh (30s)
            </label>
            <button
              onClick={refreshAll}
              disabled={isLoading}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {isLoading ? '🔄' : '🔄'} Refresh
            </button>
          </div>
        </div>

        {/* Analytics */}
        <div className="mb-8">
          <AdminAnalytics />
        </div>

        {/* System Overview */}
        {systemStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Total Users</p>
                  <p className="text-2xl font-bold text-white">{systemStats.totalUsers.toLocaleString()}</p>
                </div>
                <div className="text-3xl">👥</div>
              </div>
            </div>
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Total Projects</p>
                  <p className="text-2xl font-bold text-white">{systemStats.totalProjects.toLocaleString()}</p>
                </div>
                <div className="text-3xl">🎬</div>
              </div>
            </div>
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Videos Generated</p>
                  <p className="text-2xl font-bold text-white">{systemStats.totalVideos.toLocaleString()}</p>
                </div>
                <div className="text-3xl">🎥</div>
              </div>
            </div>
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">API Calls Today</p>
                  <p className="text-2xl font-bold text-white">{systemStats.apiCallsToday.toLocaleString()}</p>
                </div>
                <div className="text-3xl">📊</div>
              </div>
            </div>
          </div>
        )}

        {/* Service Health */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 mb-8">
          <div className="p-6 border-b border-gray-700">
            <h2 className="text-xl font-bold text-white">🔧 Service Health</h2>
            <p className="text-gray-400 text-sm">Real-time monitoring of all microservices</p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {services.map((service) => (
                <div
                  key={service.service}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    selectedService === service.service
                      ? 'border-amber-500 bg-amber-500/10'
                      : 'border-gray-600 hover:border-gray-500'
                  }`}
                  onClick={() => setSelectedService(
                    selectedService === service.service ? null : service.service
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-white">{service.service}</h3>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(service.status)}`}>
                      {getStatusIcon(service.status)} {service.status}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Requests:</span>
                      <span className="text-white">{service.requests.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Errors:</span>
                      <span className="text-red-400">{service.errors}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Avg Response:</span>
                      <span className="text-white">{service.avgResponseTime.toFixed(0)}ms</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Cache Management */}
        {cacheStats && (
          <div className="bg-gray-800 rounded-lg border border-gray-700 mb-8">
            <div className="p-6 border-b border-gray-700">
              <h2 className="text-xl font-bold text-white">💾 Cache Management</h2>
              <p className="text-gray-400 text-sm">Performance optimization and cache statistics</p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.entries(cacheStats).map(([service, stats]) => (
                  <div key={service} className="p-4 rounded-lg border border-gray-600">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-white capitalize">{service}</h3>
                      <button
                        onClick={() => clearCache(service)}
                        className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors"
                      >
                        Clear
                      </button>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Hits:</span>
                        <span className="text-green-400">{stats.hits}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Misses:</span>
                        <span className="text-red-400">{stats.misses}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Size:</span>
                        <span className="text-white">{stats.size}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Service Details */}
        {selectedService && (
          <div className="bg-gray-800 rounded-lg border border-gray-700">
            <div className="p-6 border-b border-gray-700">
              <h2 className="text-xl font-bold text-white">🔍 {selectedService} Details</h2>
              <p className="text-gray-400 text-sm">Detailed service information and dependencies</p>
            </div>
            <div className="p-6">
              {(() => {
                const service = services.find(s => s.service === selectedService);
                if (!service) return null;
                
                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 bg-gray-700 rounded-lg">
                        <h4 className="font-semibold text-white mb-2">Performance</h4>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Total Requests:</span>
                            <span className="text-white">{service.requests.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Error Rate:</span>
                            <span className="text-red-400">
                              {service.requests > 0 ? ((service.errors / service.requests) * 100).toFixed(2) : 0}%
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Avg Response Time:</span>
                            <span className="text-white">{service.avgResponseTime.toFixed(0)}ms</span>
                          </div>
                        </div>
                      </div>
                      <div className="p-4 bg-gray-700 rounded-lg">
                        <h4 className="font-semibold text-white mb-2">Status</h4>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Current Status:</span>
                            <span className={`font-medium ${getStatusColor(service.status)}`}>
                              {getStatusIcon(service.status)} {service.status}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Last Checked:</span>
                            <span className="text-white">
                              {new Date(service.lastChecked).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="p-4 bg-gray-700 rounded-lg">
                        <h4 className="font-semibold text-white mb-2">Actions</h4>
                        <div className="space-y-2">
                          <button
                            onClick={() => clearCache(selectedService)}
                            className="w-full px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                          >
                            Clear Cache
                          </button>
                          <button
                            onClick={() => fetchServiceMetrics()}
                            className="w-full px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm rounded transition-colors"
                          >
                            Refresh Status
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
