import React from 'react';
import { useJobProgress } from '../hooks/useJobProgress';

interface JobProgressProps {
  jobId?: string | null;
  endpoint?: string;
  compact?: boolean;
}

export const JobProgress: React.FC<JobProgressProps> = ({ jobId, endpoint, compact = false }) => {
  const { progress, stage, message, etaSeconds, connected, error } = useJobProgress({ jobId, endpoint, auto: true });

  if (!jobId || !endpoint) return null;

  return (
    <div className={`rounded border ${compact ? 'p-2 text-xs' : 'p-3 text-sm'} ${connected ? 'border-amber-600 bg-gray-900/50' : 'border-gray-700 bg-gray-900/40'}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="text-gray-200 font-medium">{stage || 'Working…'}</div>
        <div className="text-gray-400">{Math.round(progress)}%</div>
      </div>
      <div className="w-full h-2 bg-gray-700 rounded overflow-hidden">
        <div className="h-full bg-amber-500 transition-all" style={{ width: `${Math.round(progress)}%` }} />
      </div>
      {(message || typeof etaSeconds === 'number' || error) && (
        <div className="mt-1 flex items-center justify-between text-gray-400">
          <div className="truncate">{error ? <span className="text-red-400">{error}</span> : message}</div>
          {typeof etaSeconds === 'number' && <div className="ml-2 whitespace-nowrap">ETA ~ {Math.max(1, Math.round(etaSeconds))}s</div>}
        </div>
      )}
    </div>
  );
};

export default JobProgress;

