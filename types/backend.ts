// Shared backend service response types for health, metrics, and cache

export interface ServiceMetricsPayload {
  requests?: number;
  errors?: number;
  avgResponseTime?: number;
}

export interface HealthResponse {
  status: 'ok' | 'healthy' | 'unhealthy' | string;
  metrics?: ServiceMetricsPayload;
  dependencies?: Record<string, unknown>;
}

export interface CacheStatusResponse {
  hits?: number;
  misses?: number;
  size?: string;
}

export interface CacheStatusEnvelope {
  service: string;
  data?: CacheStatusResponse;
  error?: string;
}

