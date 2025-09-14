import { useEffect, useRef, useState } from 'react';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';
import { firebaseApp } from '../lib/firebase';

type ProgressEvent = {
  jobId: string;
  progress?: number; // 0-100
  stage?: string;    // text like 'uploading', 'rendering'
  message?: string;  // free-form update
  etaSeconds?: number;
  done?: boolean;
  error?: string;
};

export function useJobProgress(opts: { jobId?: string | null; endpoint?: string; auto?: boolean }) {
  const { jobId, endpoint, auto = true } = opts;
  const [progress, setProgress] = useState<number>(0);
  const [stage, setStage] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [etaSeconds, setEtaSeconds] = useState<number | undefined>(undefined);
  const [connected, setConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [perScene, setPerScene] = useState<Record<string, number>>({});
  const esRef = useRef<EventSource | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const bufferedRef = useRef<ProgressEvent | null>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (!auto || !jobId || !endpoint || typeof window === 'undefined') return;
    if (!('EventSource' in window)) return; // Browser not supporting SSE
    try {
      const url = `${endpoint}?jobId=${encodeURIComponent(jobId)}`;
      const es = new EventSource(url, { withCredentials: false });
      esRef.current = es;
      es.onopen = () => setConnected(true);
      es.onerror = () => { setConnected(false); /* do not set error aggressively to avoid noise */ };
      es.onmessage = (evt) => {
        try {
          const data: any = JSON.parse(evt.data || '{}');
          bufferedRef.current = data;
          const now = Date.now();
          const since = now - (lastUpdateRef.current || 0);
          const flush = () => {
            const d: any = bufferedRef.current; bufferedRef.current = null; lastUpdateRef.current = Date.now(); if (!d) return;
            if (typeof d.progress === 'number') setProgress(Math.max(0, Math.min(100, d.progress)));
            if (d.stage) setStage(d.stage);
            if (d.message) setMessage(d.message);
            if (typeof d.etaSeconds === 'number') setEtaSeconds(d.etaSeconds);
            if (d.error) setError(d.error);
            if (d.perScene) setPerScene(d.perScene || {});
            if (d.done) { setProgress(100); setConnected(false); try { es.close(); } catch {} }
          };
          if (since >= 200) {
            flush();
          } else {
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(flush, 200 - since);
          }
        } catch (_) {}
      };
      return () => { try { es.close(); } catch {} };
    } catch (_) {
      // ignore; fall back to non-streaming UI
    }
  }, [jobId, endpoint, auto]);

  // Firestore fallback/live view (persists across instance restarts)
  useEffect(() => {
    if (!jobId) return;
    try {
      const db = getFirestore(firebaseApp as any);
      const ref = doc(db, 'job_progress', jobId);
      const unsub = onSnapshot(ref, (snap) => {
        const d: any = snap.data(); if (!d) return;
        if (typeof d.progress === 'number') setProgress(Math.max(0, Math.min(100, d.progress)));
        if (d.stage) setStage(d.stage);
        if (d.message) setMessage(d.message);
        if (typeof d.etaSeconds === 'number') setEtaSeconds(d.etaSeconds);
        if (d.error) setError(d.error);
        if (d.perScene) setPerScene(d.perScene || {});
        if (d.done) setConnected(false);
      });
      return () => unsub();
    } catch (_) { return; }
  }, [jobId]);

  return { progress, stage, message, etaSeconds, connected, error, perScene };
}
