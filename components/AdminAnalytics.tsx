import React, { useState, useEffect } from 'react';
import { apiConfig } from '../config/apiConfig';

interface AnalyticsData {
  totalRequests: number;
  successRate: number;
  averageResponseTime: number;
  errorRate: number;
  topEndpoints: Array<{ endpoint: string; count: number }>;
  hourlyStats: Array<{ hour: string; requests: number; errors: number }>;
}

const AdminAnalytics: React.FC = () => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Mock analytics data - in a real implementation, this would come from a dedicated analytics API
    const mockAnalytics: AnalyticsData = {
      totalRequests: Math.floor(Math.random() * 10000) + 5000,
      successRate: 95 + Math.random() * 4, // 95-99%
      averageResponseTime: 200 + Math.random() * 300, // 200-500ms
      errorRate: Math.random() * 3, // 0-3%
      topEndpoints: [
        { endpoint: '/render', count: Math.floor(Math.random() * 1000) + 500 },
        { endpoint: '/narrate', count: Math.floor(Math.random() * 800) + 400 },
        { endpoint: '/upload-image', count: Math.floor(Math.random() * 600) + 300 },
        { endpoint: '/align', count: Math.floor(Math.random() * 500) + 250 },
        { endpoint: '/compose-music', count: Math.floor(Math.random() * 400) + 200 },
      ],
      hourlyStats: Array.from({ length: 24 }, (_, i) => ({
        hour: `${i.toString().padStart(2, '0')}:00`,
        requests: Math.floor(Math.random() * 100) + 10,
        errors: Math.floor(Math.random() * 5),
      })),
    };

    setTimeout(() => {
      setAnalytics(mockAnalytics);
      setIsLoading(false);
    }, 1000);
  }, []);

  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-700 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-700 rounded"></div>
            <div className="h-4 bg-gray-700 rounded w-5/6"></div>
            <div className="h-4 bg-gray-700 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!analytics) return null;

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700">
      <div className="p-6 border-b border-gray-700">
        <h2 className="text-xl font-bold text-white">📊 Real-time Analytics</h2>
        <p className="text-gray-400 text-sm">System performance and usage metrics</p>
      </div>
      <div className="p-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-700 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Requests</p>
                <p className="text-2xl font-bold text-white">{analytics.totalRequests.toLocaleString()}</p>
              </div>
              <div className="text-3xl">📈</div>
            </div>
          </div>
          <div className="bg-gray-700 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Success Rate</p>
                <p className="text-2xl font-bold text-green-400">{analytics.successRate.toFixed(1)}%</p>
              </div>
              <div className="text-3xl">✅</div>
            </div>
          </div>
          <div className="bg-gray-700 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Avg Response Time</p>
                <p className="text-2xl font-bold text-blue-400">{analytics.averageResponseTime.toFixed(0)}ms</p>
              </div>
              <div className="text-3xl">⚡</div>
            </div>
          </div>
          <div className="bg-gray-700 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Error Rate</p>
                <p className="text-2xl font-bold text-red-400">{analytics.errorRate.toFixed(2)}%</p>
              </div>
              <div className="text-3xl">⚠️</div>
            </div>
          </div>
        </div>

        {/* Top Endpoints */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-white mb-4">🔥 Top Endpoints</h3>
          <div className="space-y-3">
            {analytics.topEndpoints.map((endpoint, index) => (
              <div key={endpoint.endpoint} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-amber-400 font-bold">#{index + 1}</span>
                  <code className="text-green-400 font-mono">{endpoint.endpoint}</code>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-32 bg-gray-600 rounded-full h-2">
                    <div 
                      className="bg-amber-500 h-2 rounded-full" 
                      style={{ width: `${(endpoint.count / analytics.topEndpoints[0].count) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-white font-semibold">{endpoint.count.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Hourly Stats Chart */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">📅 Hourly Request Volume</h3>
          <div className="bg-gray-700 p-4 rounded-lg">
            <div className="flex items-end justify-between h-32 gap-1">
              {analytics.hourlyStats.map((stat, index) => {
                const maxRequests = Math.max(...analytics.hourlyStats.map(s => s.requests));
                const height = (stat.requests / maxRequests) * 100;
                return (
                  <div key={stat.hour} className="flex flex-col items-center flex-1">
                    <div className="flex flex-col items-center">
                      <div 
                        className="bg-amber-500 w-full rounded-t transition-all duration-300 hover:bg-amber-400"
                        style={{ height: `${height}%` }}
                        title={`${stat.hour}: ${stat.requests} requests, ${stat.errors} errors`}
                      ></div>
                      {stat.errors > 0 && (
                        <div 
                          className="bg-red-500 w-full rounded-b"
                          style={{ height: `${(stat.errors / maxRequests) * 100}%` }}
                          title={`${stat.errors} errors`}
                        ></div>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 mt-2 transform -rotate-45 origin-left">
                      {stat.hour}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-center gap-6 mt-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-amber-500 rounded"></div>
                <span className="text-gray-300">Requests</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded"></div>
                <span className="text-gray-300">Errors</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAnalytics;
