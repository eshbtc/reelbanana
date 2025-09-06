import React, { useCallback, useMemo, useState } from 'react';
import { apiConfig } from '../config/apiConfig';

type ServiceKey = 'upload' | 'narrate' | 'align' | 'render' | 'compose' | 'polish' | 'apiKey';

type Status = 'unknown' | 'ok' | 'warn' | 'error';

interface ServiceStatus {
  status: Status;
  message?: string;
  latencyMs?: number;
  lastChecked?: string;
}

const AdminHealth: React.FC = () => {
  const services = useMemo(() => (
    [
      { key: 'upload' as ServiceKey, name: 'Upload Assets', url: `${apiConfig.baseUrls.upload}/health` },
      { key: 'narrate' as ServiceKey, name: 'Narrate (TTS)', url: `${apiConfig.baseUrls.narrate}/health` },
      { key: 'align' as ServiceKey, name: 'Align Captions', url: `${apiConfig.baseUrls.align}/health` },
      { key: 'render' as ServiceKey, name: 'Render', url: `${apiConfig.baseUrls.render}/health` },
      { key: 'compose' as ServiceKey, name: 'Compose Music', url: `${apiConfig.baseUrls.compose}/health` },
      { key: 'polish' as ServiceKey, name: 'Polish (FAL)', url: `${apiConfig.baseUrls.polish}/health` },
      { key: 'apiKey' as ServiceKey, name: 'API Key Service', url: `${apiConfig.baseUrls.apiKey}/health` },
    ]
  ), []);

  const [statuses, setStatuses] = useState<Record<ServiceKey, ServiceStatus>>({
    upload: { status: 'unknown' },
    narrate: { status: 'unknown' },
    align: { status: 'unknown' },
    render: { status: 'unknown' },
    compose: { status: 'unknown' },
    polish: { status: 'unknown' },
    apiKey: { status: 'unknown' },
  });
  const [checking, setChecking] = useState<boolean>(false);

  const checkOne = useCallback(async (key: ServiceKey, url: string) => {
    const start = Date.now();
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 6000);
      const res = await fetch(url, { method: 'GET', mode: 'cors', signal: ctrl.signal });
      clearTimeout(to);
      const ms = Date.now() - start;
      if (!res.ok) {
        setStatuses(prev => ({
          ...prev,
          [key]: { status: 'error', message: `HTTP ${res.status}`, latencyMs: ms, lastChecked: new Date().toISOString() }
        }));
        return;
      }
      // Try to parse JSON and inspect a status field
      let json: any = null;
      try { json = await res.json(); } catch (_) {}
      const reported = (json?.status || '').toString().toLowerCase();
      const status: Status = reported === 'ok' ? 'ok' : 'warn';
      setStatuses(prev => ({
        ...prev,
        [key]: { status, message: reported ? `status=${reported}` : undefined, latencyMs: ms, lastChecked: new Date().toISOString() }
      }));
    } catch (e: any) {
      const ms = Date.now() - start;
      const msg = e?.name === 'AbortError' ? 'timeout' : (e?.message || 'network-error');
      setStatuses(prev => ({
        ...prev,
        [key]: { status: 'error', message: msg, latencyMs: ms, lastChecked: new Date().toISOString() }
      }));
    }
  }, []);

  const checkAll = useCallback(async () => {
    setChecking(true);
    try {
      await Promise.all(services.map(s => checkOne(s.key, s.url)));
    } finally {
      setChecking(false);
    }
  }, [services, checkOne]);

  const badge = (s: Status) => {
    const map: Record<Status, string> = {
      unknown: 'bg-gray-700 text-gray-200',
      ok: 'bg-green-700 text-white',
      warn: 'bg-yellow-700 text-white',
      error: 'bg-red-700 text-white',
    };
    const text: Record<Status, string> = {
      unknown: 'UNKNOWN',
      ok: 'OK',
      warn: 'WARN',
      error: 'ERROR',
    };
    return <span className={`px-2 py-0.5 rounded text-xs font-bold ${map[s]}`}>{text[s]}</span>;
  };

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold text-white flex items-center gap-2">
          <span className="p-2 bg-emerald-500/20 rounded-lg">
            <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 20 20" fill="currentColor"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 10.707l-1.414-1.414L5 11.586l3.707 3.707L15 9l-1.414-1.414-4.879 4.879z"/></svg>
          </span>
          Service Health
        </h3>
        <button
          onClick={checkAll}
          disabled={checking}
          className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 text-white rounded-lg text-sm"
        >
          {checking ? 'Checking…' : 'Check All'}
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.map(s => {
          const st = statuses[s.key];
          return (
            <div key={s.key} className="bg-gray-800 rounded-lg border border-gray-700 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-white font-medium">{s.name}</div>
                {badge(st?.status || 'unknown')}
              </div>
              <div className="text-xs text-gray-400 break-all mb-2">{s.url}</div>
              <div className="text-xs text-gray-300 space-y-1">
                {st?.latencyMs !== undefined && (
                  <div>Latency: <span className="text-gray-100">{st.latencyMs} ms</span></div>
                )}
                {st?.message && (
                  <div>Info: <span className="text-gray-100">{st.message}</span></div>
                )}
                {st?.lastChecked && (
                  <div>Checked: <span className="text-gray-100">{new Date(st.lastChecked).toLocaleString()}</span></div>
                )}
              </div>
              <div className="mt-3 text-right">
                <button
                  onClick={() => checkOne(s.key, s.url)}
                  className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs"
                >
                  Check
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="text-[11px] text-gray-500 mt-3">
        Note: Health checks do not require App Check and only verify HTTP reachability of each service.
      </div>
    </div>
  );
};

export default AdminHealth;

