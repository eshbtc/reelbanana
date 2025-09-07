import React, { useCallback, useMemo, useState } from 'react';
import { Scene } from '../types';
import { createProject } from '../services/firebaseService';
import { generateImageSequence } from '../services/geminiService';
import { API_ENDPOINTS, apiCall } from '../config/apiConfig';
// Toast is optional; we fallback to console if provider is missing

interface HypeModeProps {
  onComplete: (result: { videoUrl: string; projectId: string }) => void;
  onFail: (error: string) => void;
}

type Step = 'input' | 'preprocess' | 'processing' | 'complete';

const defaultNarration = (
  'Meet ReelBanana — your AI‑powered cinematic studio. ' +
  'Type an idea, and watch it become a storyboard of scenes. ' +
  'Stunning visuals? Generated. Voiceover? Pro‑grade narration, with captions synced to every word. ' +
  'Music? A custom score that fits your story. ' +
  'Then we assemble everything — clean camera motion, smooth transitions, polish, and playback that just works. ' +
  'Your project is ready to publish and share. ' +
  'Create product demos, explainers, or your next launch trailer in minutes — not days. ' +
  'ReelBanana. Turn ideas into movies.'
);

const HypeMode: React.FC<HypeModeProps> = ({ onComplete, onFail }) => {
  const [step, setStep] = useState<Step>('input');
  type Entry = { kind: 'file'; file: File; preview: string } | { kind: 'ai'; prompt: string };
  const [entries, setEntries] = useState<Entry[]>([]);
  const [durations, setDurations] = useState<number[]>([]);
  const [stylize, setStylize] = useState<boolean>(false);
  const [narration, setNarration] = useState<string>(defaultNarration);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [status, setStatus] = useState<string>('');
  const [targetSeconds, setTargetSeconds] = useState<number>(120);
  const [includeCallouts, setIncludeCallouts] = useState<boolean>(true);
  const [includeCta, setIncludeCta] = useState<boolean>(true);
  const [includeTechBeat, setIncludeTechBeat] = useState<boolean>(true);
  const [genClips, setGenClips] = useState<boolean>(true);
  const [clipCount, setClipCount] = useState<number>(5);
  const [clipSeconds, setClipSeconds] = useState<number>(12);
  const [clipModel, setClipModel] = useState<string>('fal-ai/veo3/fast/image-to-video');

  const defaultCallouts = useMemo(() => (
    ['Generate Story', 'Images', 'Narration', 'Captions', 'Music', 'Render & Polish', 'Publish & Share', 'Results']
  ), []);

  // Minimal notify layer (no hooks) — avoids invalid hook calls if provider is missing
  const notify = {
    info: (m: string) => { try { (window as any)?.rbToast?.({ type: 'info', message: m }); } catch {} console.info(m); },
    success: (m: string) => { try { (window as any)?.rbToast?.({ type: 'success', message: m }); } catch {} console.log(m); },
    error: (m: string) => { try { (window as any)?.rbToast?.({ type: 'error', message: m }); } catch {} console.error(m); },
  };

  const onFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const arr = Array.from(fileList).filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f.name));
    const newEntries: Entry[] = arr.map(f => ({ kind: 'file', file: f, preview: URL.createObjectURL(f) }));
    setEntries(prev => [...prev, ...newEntries]);
    setDurations(prev => [...prev, ...newEntries.map(() => 8)]);
  };

  const fileToDataUri = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const fetchToDataUri = async (url: string): Promise<string> => {
    const resp = await fetch(url, { cache: 'no-store' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const blob = await resp.blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onerror = () => reject(new Error('FileReader failed'));
      r.onloadend = () => resolve(String(r.result || ''));
      r.readAsDataURL(blob);
    });
  };

  const overlayLabel = async (base64: string, label: string): Promise<string> => {
    try {
      if (!label) return base64;
      const img = new Image();
      const loaded = new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; });
      img.src = base64;
      await loaded;
      const w = img.width, h = img.height;
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const pad = Math.max(12, Math.round(w * 0.01));
      ctx.font = `${Math.max(20, Math.round(w * 0.03))}px Inter, system-ui, sans-serif`;
      const textW = ctx.measureText(label).width;
      const pillW = textW + pad * 2;
      const pillH = Math.max(34, Math.round(h * 0.06));
      ctx.fillStyle = 'rgba(245, 158, 11, 0.95)';
      const r = 12;
      const x = pad, y = pad;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + pillW, y, x + pillW, y + pillH, r);
      ctx.arcTo(x + pillW, y + pillH, x, y + pillH, r);
      ctx.arcTo(x, y + pillH, x, y, r);
      ctx.arcTo(x, y, x + pillW, y, r);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#111827';
      ctx.fillText(label, x + pad, y + pillH * 0.68);
      return canvas.toDataURL('image/jpeg', 0.95);
    } catch {
      return base64;
    }
  };

  const makeCtaImage = async (): Promise<string> => {
    const w = 1600, h = 900;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    // Background gradient
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#0b1220');
    g.addColorStop(1, '#1f2940');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // Glow ellipse
    ctx.fillStyle = 'rgba(245,158,11,0.25)';
    ctx.beginPath(); ctx.ellipse(w*0.5, h*0.6, w*0.45, h*0.2, 0, 0, Math.PI*2); ctx.fill();
    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 72px Inter, system-ui, sans-serif';
    ctx.fillText('🍌 ReelBanana', Math.round(w*0.25), Math.round(h*0.38));
    // Tagline
    ctx.font = '36px Inter, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText('Create your movie in minutes', Math.round(w*0.25), Math.round(h*0.45));
    // URL CTA pill
    const label = 'reelbanana.ai';
    ctx.font = '32px Inter, system-ui, sans-serif';
    const pad = 20; const tw = ctx.measureText(label).width; const pw = tw + pad*2; const ph = 56; const x = Math.round(w*0.25); const y = Math.round(h*0.52);
    ctx.fillStyle = 'rgba(245,158,11,0.95)';
    const r = 14; ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + pw, y, x + pw, y + ph, r); ctx.arcTo(x + pw, y + ph, x, y + ph, r); ctx.arcTo(x, y + ph, x, y, r); ctx.arcTo(x, y, x + pw, y, r); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#111827'; ctx.fillText(label, x + pad, y + ph*0.68);
    return canvas.toDataURL('image/jpeg', 0.95);
  };

  const start = useCallback(async () => {
    try {
      if (entries.length === 0) throw new Error('Add at least a couple of scenes: screenshots or AI-only prompts.');
      setStep('preprocess');
      setStatus('Creating project…');

      // Build working list of scenes (user entries + optional tech beat + CTA handled later)
      const techBeat: Entry[] = includeTechBeat ? [
        { kind: 'ai', prompt: 'Logos: Google Cloud Run + Firebase; minimal icons on dark gradient; amber accent; credibility beat' },
        { kind: 'ai', prompt: 'ElevenLabs narration and music — waveform + musical notes; modern tech aesthetic' },
        { kind: 'ai', prompt: 'FAL Veo 3 Fast — image-to-video motion; sleek brand visuals; subtle glow' },
        { kind: 'ai', prompt: 'Security & delivery: Firebase App Check + durable GCS URLs; clean badges; dark UI' },
        { kind: 'ai', prompt: 'Built under 48 hours — bold typography; kinetic motion; dark gradient' },
      ] : [];

      const workingEntries: Entry[] = [...entries, ...techBeat];

      // Create project with placeholder scenes
      const scenesSeed: Scene[] = workingEntries.map((_, i) => ({
        id: `hype-${i}`,
        prompt: 'Cinematic parallax over UI; soft glow; modern tech vibe; slow zoom-in.',
        narration: '',
        status: 'idle'
      }));
      const pid = await createProject({ topic: 'ReelBanana — Demo of the Demo', characterAndStyle: 'Modern cinematic tech UI; dark mode; amber accents', scenes: scenesSeed });
      setProjectId(pid);

      // Upload or stylize images per scene
      const uploadedUrls: string[][] = [];
      for (let i = 0; i < workingEntries.length; i++) {
        setStatus(`Preparing scene ${i + 1} of ${workingEntries.length}…`);
        setProgress(Math.round((i / Math.max(1, workingEntries.length)) * 30));
        const entry = workingEntries[i];
        if (entry.kind === 'file') {
          if (!stylize) {
            let base64 = await fileToDataUri(entry.file);
            if (includeCallouts) {
              const label = defaultCallouts[i % defaultCallouts.length];
              base64 = await overlayLabel(base64, label);
            }
            await apiCall(API_ENDPOINTS.upload, { projectId: pid, fileName: `scene-${i}-0.jpeg`, base64Image: base64 }, 'Upload failed');
            const bucket = 'reel-banana-35a54.firebasestorage.app';
            const url = `https://storage.googleapis.com/${bucket}/${pid}/scene-${i}-0.jpeg`;
            uploadedUrls.push([url]);
          } else {
            let base64Bg = await fileToDataUri(entry.file);
            if (includeCallouts) {
              const label = defaultCallouts[i % defaultCallouts.length];
              base64Bg = await overlayLabel(base64Bg, label);
            }
            const frames = await generateImageSequence(
              'Cinematic parallax of product UI screenshot; soft glow; depth; gradient lighting; modern tech vibe; subtle motion blur',
              'Modern cinematic tech UI; dark background; amber highlights',
              { backgroundImage: base64Bg, frames: 3, projectId: pid, sceneIndex: i }
            );
            uploadedUrls.push(frames);
          }
        } else {
          // AI-only scene generation
          const frames = await generateImageSequence(
            entry.prompt || 'Cinematic tech abstract; dark gradient; amber highlights; depth; subtle particles; premium UI motif',
            'Modern cinematic tech UI; dark background; amber highlights',
            { frames: 3, projectId: pid, sceneIndex: i }
          );
          // Overlay callout on first frame by overwriting scene-i-0.jpeg
          if (includeCallouts && frames[0]) {
            try {
              const fg = await fetchToDataUri(frames[0]);
              const lab = defaultCallouts[i % defaultCallouts.length];
              const over = await overlayLabel(fg, lab);
              await apiCall(API_ENDPOINTS.upload, { projectId: pid, fileName: `scene-${i}-0.jpeg`, base64Image: over }, 'Upload failed');
              const bucket = 'reel-banana-35a54.firebasestorage.app';
              frames[0] = `https://storage.googleapis.com/${bucket}/${pid}/scene-${i}-0.jpeg`;
            } catch {}
          }
          uploadedUrls.push(frames);
        }
      }

      // CTA end frame (optional)
      if (includeCta) {
        const i = workingEntries.length;
        setStatus('Adding CTA frame…');
        const base = await makeCtaImage();
        await apiCall(API_ENDPOINTS.upload, { projectId: pid, fileName: `scene-${i}-0.jpeg`, base64Image: base }, 'Upload failed');
        const bucket = 'reel-banana-35a54.firebasestorage.app';
        const url = `https://storage.googleapis.com/${bucket}/${pid}/scene-${i}-0.jpeg`;
        uploadedUrls.push([url]);
        // Note: we don't mutate entries state here; durations handled locally below
      }

      setStep('processing');
      setStatus('Narrating…');
      setProgress(40);
      const narr = await apiCall(API_ENDPOINTS.narrate, { projectId: pid, narrationScript: narration, emotion: 'professional' }, 'Narration failed');

      setStatus('Aligning captions…');
      setProgress(55);
      const align = await apiCall(API_ENDPOINTS.align, { projectId: pid, gsAudioPath: narr.gsAudioPath }, 'Caption sync failed');

      setStatus('Composing music…');
      setProgress(65);
      const comp = await apiCall(API_ENDPOINTS.compose, { projectId: pid, narrationScript: narration }, 'Music generation failed');

      // Optional: generate motion clips for first N file scenes
      if (genClips) {
        setStatus('Generating motion clips…');
        const indexes: number[] = entries
          .map((e, i) => ({ e, i }))
          .filter(x => x.e.kind === 'file')
          .slice(0, Math.max(0, clipCount))
          .map(x => x.i);
        for (let j = 0; j < indexes.length; j++) {
          const i = indexes[j];
          setProgress(70 + Math.round((j / Math.max(1, indexes.length)) * 10));
          try {
            await apiCall(API_ENDPOINTS.generateClip, { projectId: pid, sceneIndex: i, veoPrompt: 'Cinematic UI motion; subtle parallax; modern tech vibe', videoSeconds: clipSeconds, modelOverride: clipModel }, 'Clip generation failed');
          } catch (e) {
            console.warn('Clip generation failed for scene', i, e);
          }
        }
      }

      // Build scenes payload
      const durationsWorking: number[] = (() => {
        const d = [...durations];
        if (includeTechBeat) d.push(...techBeat.map(() => 8));
        if (includeCta) d.push(8);
        return d;
      })();

      const totalEntries = workingEntries.length + (includeCta ? 1 : 0);
      const renderScenes = Array.from({ length: totalEntries }).map((_, i) => ({
        duration: Math.max(3, Math.min(12, durationsWorking[i] || 8)),
        camera: i % 3 === 0 ? 'zoom-in' : i % 3 === 1 ? 'zoom-out' : 'pan-left',
        transition: i === 0 ? 'fade' : (i % 2 === 0 ? 'wipe' : 'fade')
      }));

      setStatus('Rendering movie…');
      setProgress(80);
      let render;
      try {
        render = await apiCall(API_ENDPOINTS.render, { projectId: pid, scenes: renderScenes, gsAudioPath: narr.gsAudioPath, srtPath: align.srtPath, gsMusicPath: comp.gsMusicPath, useFal: false }, 'Video rendering failed');
      } catch (_) {
        // Try FAL once if FFmpeg path blocked in env
        render = await apiCall(API_ENDPOINTS.render, { projectId: pid, scenes: renderScenes, gsAudioPath: narr.gsAudioPath, srtPath: align.srtPath, gsMusicPath: comp.gsMusicPath, useFal: true, falVideoSeconds: Math.max(8, renderScenes.reduce((s, r) => s + (r.duration || 3), 0)) }, 'Video rendering failed (FAL)');
      }

      setStatus('Polishing…');
      setProgress(92);
      let finalUrl = render.videoUrl;
      try {
        const polish = await apiCall(API_ENDPOINTS.polish, { projectId: pid, videoUrl: render.videoUrl }, 'Polish failed');
        finalUrl = polish.polishedUrl || render.videoUrl;
      } catch (_) {}

      setStatus('Done');
      setProgress(100);
      setStep('complete');
      notify.success('Hype video ready!');
      onComplete({ videoUrl: finalUrl, projectId: pid });
    } catch (e: any) {
      const msg = String(e?.message || e);
      notify.error(msg);
      onFail(msg);
    }
  }, [entries, durations, stylize, narration, onComplete, onFail]);

  const totalSeconds = useMemo(() => durations.reduce((s, d) => s + (d || 0), 0), [durations]);
  const autoDistribute = () => {
    if (durations.length === 0) return;
    const n = durations.length;
    const base = Math.floor(targetSeconds / n);
    const rem = targetSeconds % n;
    const next = Array.from({ length: n }, (_, i) => Math.max(3, Math.min(12, base + (i < rem ? 1 : 0))));
    setDurations(next);
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-white mb-4">Hype Mode — Demo of the Demo</h1>
      {step === 'input' && (
        <div className="space-y-6">
          <div className="bg-gray-800 border border-gray-700 rounded p-4">
            <p className="text-gray-300 mb-2">Upload 2–12 UI screenshots (PNG/JPG/WEBP) and/or add AI‑only scenes. We’ll assemble a cinematic montage.</p>
            <div className="flex items-center gap-3 flex-wrap">
              <input type="file" multiple accept="image/*" onChange={(e) => onFilesSelected(e.target.files)} />
              <button onClick={() => setEntries(prev => [...prev, { kind: 'ai', prompt: 'Cinematic tech abstract; dark gradient; amber highlights; soft glow; premium UI motif' }])} className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded">Add AI‑only scene</button>
              <button onClick={() => setEntries(prev => [...prev,
                { kind: 'ai', prompt: 'Abstract lines/particles over dark UI silhouette; subtle volumetric light' },
                { kind: 'ai', prompt: 'Gradient glow tech frame; depth; neon highlights; parallax' },
                { kind: 'ai', prompt: 'Logo stinger on dark gradient; tasteful glow; crisp typography' }
              ])} className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded">Add 3 AI filler scenes</button>
            </div>
            {entries.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
                {entries.map((entry, i) => (
                  <div key={i} className="bg-gray-900 rounded overflow-hidden border border-gray-700">
                    {entry.kind === 'file' ? (
                      <img src={entry.preview} alt={`shot-${i}`} className="w-full h-32 object-cover" />
                    ) : (
                      <div className="w-full h-32 flex items-center justify-center text-xs text-gray-400">AI Scene<br/>{entry.prompt.slice(0,60)}…</div>
                    )}
                    <div className="p-2 text-xs text-gray-400 flex items-center gap-2">
                      <span>Scene {i + 1}</span>
                      <span className="ml-auto">Duration</span>
                      <input type="number" min={3} max={12} value={durations[i] || 8} onChange={(e) => setDurations(d => { const n=[...d]; n[i] = parseFloat(e.target.value || '8'); return n; })} className="w-16 bg-gray-800 border border-gray-600 rounded px-1 text-white" />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {entries.length > 0 && (
              <div className="flex items-center gap-3 text-gray-400 text-sm mt-2">
                <span>Total: ~{totalSeconds}s</span>
                <span className="ml-4">Target</span>
                <input type="number" min={20} max={300} value={targetSeconds} onChange={(e) => setTargetSeconds(parseInt(e.target.value || '120', 10) || 120)} className="w-20 bg-gray-800 border border-gray-600 rounded px-1 text-white" />
                <button onClick={autoDistribute} className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded">Auto distribute</button>
              </div>
            )}
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded p-4">
            <label className="flex items-center gap-2 text-gray-300">
              <input type="checkbox" checked={stylize} onChange={(e) => setStylize(e.target.checked)} />
              Stylize screenshots into cinematic frames (slower; optional)
            </label>
            <p className="text-xs text-gray-500 mt-1">If enabled, we’ll generate 3 cinematic frames per screenshot inspired by your image (parallax, glow).</p>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded p-4">
            <label className="flex items-center gap-4 text-gray-300">
              <span className="flex items-center gap-2"><input type="checkbox" checked={includeCallouts} onChange={(e)=>setIncludeCallouts(e.target.checked)} /> Overlay callouts per scene</span>
              <span className="flex items-center gap-2"><input type="checkbox" checked={includeCta} onChange={(e)=>setIncludeCta(e.target.checked)} /> Include CTA end frame</span>
              <span className="flex items-center gap-2"><input type="checkbox" checked={includeTechBeat} onChange={(e)=>setIncludeTechBeat(e.target.checked)} /> Include Tech Beat (stack + 48h)</span>
            </label>
            <p className="text-xs text-gray-500 mt-1">Callouts: {defaultCallouts.join(' • ')}. CTA adds a branded end card with logo + URL.</p>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded p-4">
            <label className="flex items-center gap-2 text-gray-300 mb-2">
              <input type="checkbox" checked={genClips} onChange={(e)=>setGenClips(e.target.checked)} /> Generate Motion Clips (FAL image-to-video)
            </label>
            {genClips && (
              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-300">
                <span>Model</span>
                <select value={clipModel} onChange={(e)=>setClipModel(e.target.value)} className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white">
                  <option value="fal-ai/veo3/fast/image-to-video">Veo 3 Fast (i2v)</option>
                  <option value="fal-ai/ltxv-13b-098-distilled/image-to-video">LTXV 13B (i2v)</option>
                </select>
                <span>Clips</span>
                <input type="number" min={1} max={8} value={clipCount} onChange={(e)=>setClipCount(Math.max(1, Math.min(8, parseInt(e.target.value || '5', 10))))} className="w-16 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white" />
                <span>Seconds/clip</span>
                <input type="number" min={6} max={20} value={clipSeconds} onChange={(e)=>setClipSeconds(Math.max(6, Math.min(20, parseInt(e.target.value || '12', 10))))} className="w-16 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white" />
                <span className="text-xs text-gray-500">We’ll use your first N screenshot scenes for motion.</span>
              </div>
            )}
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded p-4">
            <label className="text-gray-300 text-sm mb-1 block">Narration</label>
            <textarea className="w-full h-32 bg-gray-900 border border-gray-700 rounded p-3 text-white text-sm" value={narration} onChange={(e) => setNarration(e.target.value)} />
          </div>
          <div>
            <button onClick={start} disabled={entries.length === 0} className="bg-amber-500 hover:bg-amber-600 text-black font-bold px-6 py-3 rounded disabled:opacity-50">Build Hype Video</button>
          </div>
        </div>
      )}

      {step !== 'input' && (
        <div className="bg-gray-800 border border-gray-700 rounded p-6 text-center">
          <div className="text-2xl text-white mb-2">{status}</div>
          <div className="w-full h-2 bg-gray-700 rounded">
            <div className="h-2 bg-amber-500 rounded" style={{ width: `${progress}%` }} />
          </div>
          {projectId && (
            <div className="text-gray-400 text-sm mt-3">Project: {projectId}</div>
          )}
        </div>
      )}
    </div>
  );
};

export default HypeMode;
