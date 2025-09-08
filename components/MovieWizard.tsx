import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useConfirm } from './ConfirmProvider';
import { getFirestore, collection, addDoc, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { firebaseApp } from '../lib/firebase';
import { getCurrentUser as getUser } from '../services/authService';
import { Check, Play, Loader2, AlertCircle, SkipForward, PlayCircle, Settings, Sparkles, Image as ImageIcon } from 'lucide-react';
import { API_ENDPOINTS, apiCall, apiConfig } from '../config/apiConfig';
import { getCurrentUser } from '../services/authService';

interface WizardStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
  result?: any;
  error?: string;
}

interface MovieWizardProps {
  scenes: any[];
  emotion?: string;
  proPolish?: boolean;
  projectId: string;
  demoMode?: boolean;
  onComplete: (result: { videoUrl: string; projectId: string }) => void;
  onFail: (error: string) => void;
  onBack?: () => void;
}

const WIZARD_STEPS: Omit<WizardStep, 'status' | 'result' | 'error'>[] = [
  {
    id: 'upload',
    title: 'Upload Assets',
    description: 'Upload generated images to cloud storage'
  },
  {
    id: 'narrate',
    title: 'Generate Narration', 
    description: 'Create AI voiceover using ElevenLabs'
  },
  {
    id: 'align',
    title: 'Sync Captions',
    description: 'Generate synchronized captions with Speech-to-Text'
  },
  {
    id: 'compose',
    title: 'Create Music',
    description: 'Generate background music score'
  },
  {
    id: 'render',
    title: 'Render Video',
    description: 'Assemble final movie with FFmpeg'
  },
  {
    id: 'polish',
    title: 'Pro Polish',
    description: 'Upscale and add motion interpolation'
  }
];

const MovieWizard: React.FC<MovieWizardProps> = ({ 
  scenes, 
  emotion = 'neutral', 
  proPolish = false, 
  projectId, 
  demoMode = false,
  onComplete, 
  onFail,
  onBack 
}) => {
  const [steps, setSteps] = useState<WizardStep[]>(() =>
    WIZARD_STEPS.map(step => ({
      ...step,
      status: 'pending' as const,
    }))
  );
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [autoMode, setAutoMode] = useState(true);
  const [clipStatus, setClipStatus] = useState<Array<{ exists: boolean; url?: string }>>([]);
  // Motion clip generation controls (default ON, backend stitches)
  const [autoGenerateClips, setAutoGenerateClips] = useState<boolean>(true);
  const [forceClips, setForceClips] = useState<boolean>(false);
  const [clipSeconds, setClipSeconds] = useState<number | ''>('');
  const [clipConcurrency, setClipConcurrency] = useState<number>(2);
  const [clipModel, setClipModel] = useState<string>('fal-ai/veo3/fast/image-to-video');

  // Defensive context usage to prevent null context errors
  let confirm: any = null;
  
  try {
    confirm = useConfirm();
  } catch (error) {
    console.warn('Confirm context not available:', error);
    confirm = () => Promise.resolve(false);
  }

  // Estimated step durations (seconds) with rolling average override
  const [etas, setEtas] = useState<Record<string, [number, number]>>({
    upload: [2, 10],
    narrate: [5, 15],
    align: [10, 25],
    compose: [2, 5],
    render: [20, 45],
    polish: [15, 60],
  });

  const db = getFirestore(firebaseApp);

  const loadMetrics = useCallback(async () => {
    try {
      const user = getUser();
      if (!user) return;
      const q = query(
        collection(db, 'wizard_metrics'),
        where('userId', '==', user.uid),
        orderBy('ts', 'desc'),
        limit(100)
      );
      const snap = await getDocs(q);
      const data: Record<string, number[]> = {};
      snap.forEach(doc => {
        const d: any = doc.data();
        const step: string = d.stepId;
        const ms: number = d.ms;
        if (!data[step]) data[step] = [];
        data[step].push(ms);
      });
      const next: Record<string, [number, number]> = { ...etas };
      Object.entries(data).forEach(([step, arr]) => {
        if (arr.length) {
          const avg = arr.reduce((a, b) => a + b, 0) / arr.length; // ms
          const sec = Math.max(1, Math.round(avg / 1000));
          next[step] = [Math.max(1, Math.floor(sec * 0.8)), Math.ceil(sec * 1.4)];
        }
      });
      setEtas(next);
    } catch {}
  }, [db, etas]);

  useEffect(() => { loadMetrics(); }, [loadMetrics]);

  // Per-scene clip detection (best-effort), polls until clips appear
  useEffect(() => {
    let timer: any;
    const bucketCandidates = [
      'reel-banana-videos-public',
      apiConfig.firebase.storageBucket,
    ].filter(Boolean);
    const checkClips = async () => {
      if (!projectId || !Array.isArray(scenes) || scenes.length === 0) return;
      const updates: Array<{ exists: boolean; url?: string }> = [];
      for (let i = 0; i < scenes.length; i++) {
        let found = false; let url: string | undefined;
        for (const bucket of bucketCandidates) {
          const test = `https://storage.googleapis.com/${bucket}/${projectId}/clips/scene-${i}.mp4`;
          try { const res = await fetch(test, { method: 'HEAD' }); if (res.ok) { found = true; url = test; break; } } catch {}
        }
        updates[i] = { exists: found, url } as any;
      }
      setClipStatus(updates);
      const allDone = updates.every(x => x?.exists);
      if (!allDone) timer = setTimeout(checkClips, 3000);
    };
    checkClips();
    return () => { if (timer) clearTimeout(timer); };
  }, [projectId, scenes]);

  const remainingEta = useMemo(() => {
    let totalMin = 0; let totalMax = 0;
    for (let i = currentStepIndex; i < steps.length; i++) {
      const s = steps[i];
      const rng = etas[s.id] || [2, 5];
      if (s.status === 'pending' || s.status === 'processing' || s.status === 'failed') { totalMin += rng[0]; totalMax += rng[1]; }
    }
    return `${totalMin}-${totalMax}s`;
  }, [currentStepIndex, steps, etas]);

  // Update step status
  const updateStep = (stepId: string, updates: Partial<WizardStep>) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, ...updates } : step
    ));
  };

  // Persist wizard state per project in session storage
  useEffect(() => {
    try {
      const key = `wizard:${projectId}`;
      const payload = { steps, currentStepIndex };
      sessionStorage.setItem(key, JSON.stringify(payload));
    } catch {}
  }, [steps, currentStepIndex, projectId]);

  // Resume wizard state (only if there was real progress)
  useEffect(() => {
    (async () => {
      try {
        const key = `wizard:${projectId}`;
        const raw = sessionStorage.getItem(key);
        if (!raw) return;
        const saved = JSON.parse(raw);
        // Only offer resume if any step has progressed beyond 'pending'
        const hasProgress = Array.isArray(saved?.steps) && saved.steps.some((s: any) => s?.status && s.status !== 'pending');
        if (saved && Array.isArray(saved.steps) && hasProgress) {
          const ok = await confirm({ title: 'Resume Wizard?', message: 'Resume previous wizard session?', confirmText: 'Resume', cancelText: 'Start Fresh' });
          if (ok) {
            setSteps(saved.steps);
            if (typeof saved.currentStepIndex === 'number') setCurrentStepIndex(saved.currentStepIndex);
          } else {
            sessionStorage.removeItem(key);
          }
        } else {
          // No meaningful progress, clear and start fresh silently
          sessionStorage.removeItem(key);
        }
      } catch {}
    })();
  }, [projectId, confirm]);

  // Execute a step
  const executeStep = async (stepId: string) => {
    const step = steps.find(s => s.id === stepId);
    if (!step) return;

    updateStep(stepId, { status: 'processing' });

    try {
      const started = Date.now();
      let result;
      
      switch (stepId) {
        case 'upload':
          result = await executeUpload();
          break;
        case 'narrate':
          result = await executeNarrate();
          break;
        case 'align':
          result = await executeAlign();
          break;
        case 'compose':
          result = await executeCompose();
          break;
        case 'render':
          result = await executeRender();
          break;
        case 'polish':
          result = await executePolish();
          break;
        default:
          throw new Error(`Unknown step: ${stepId}`);
      }

      const status = result?.cached ? 'skipped' : 'completed';
      updateStep(stepId, { status, result });
      try {
        const user = getUser();
        const elapsed = Date.now() - started;
        await addDoc(collection(db, 'wizard_metrics'), { userId: user?.uid || null, stepId, ms: elapsed, ts: new Date().toISOString() });
      } catch {}
      
      // Move to next step if not at the end
      const nextIndex = steps.findIndex(s => s.id === stepId) + 1;
      if (nextIndex < steps.length) {
        setCurrentStepIndex(nextIndex);
      } else {
        // Wizard complete
        const renderStep = steps.find(s => s.id === 'render');
        const polishStep = steps.find(s => s.id === 'polish');
        const finalUrl = polishStep?.result?.polishedUrl || renderStep?.result?.videoUrl;
        
        if (finalUrl) {
          onComplete({ videoUrl: finalUrl, projectId });
        } else {
          onFail('No video URL found in results');
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      updateStep(stepId, { status: 'failed', error: errorMessage });
    }
  };

  // Run all remaining steps
  const runAll = useCallback(async () => {
    for (let i = currentStepIndex; i < steps.length; i++) {
      const s = steps[i];
      await executeStep(s.id);
      const after = steps.find(x => x.id === s.id);
      if (after && after.status === 'failed') break;
      setCurrentStepIndex(i + 1);
    }
  }, [currentStepIndex, steps]);

  // Step execution functions
  const executeUpload = async () => {
    // Ensure every scene image is present in Storage for this project.
    // Convert HTTP URLs to data URIs when needed and upload all frames.
    const toDataUri = async (url: string): Promise<string> => {
      if (url.startsWith('data:image/')) return url;
      if (!/^https?:\/\//i.test(url)) return url; // skip invalid
      try {
        const resp = await fetch(url, { cache: 'no-store' });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob = await resp.blob();
        const reader = new FileReader();
        const dataUri: string = await new Promise((resolve, reject) => {
          reader.onerror = () => reject(new Error('FileReader failed'));
          reader.onloadend = () => resolve(String(reader.result || ''));
          reader.readAsDataURL(blob);
        });
        if (!dataUri.startsWith('data:image/')) throw new Error('Invalid data URI');
        return dataUri;
      } catch (e) {
        console.warn('Upload: failed to convert HTTPS URL to data URI, skipping', url, e);
        return url; // leave as-is; upload will be skipped for non-data URIs
      }
    };

    // Build upload list for all frames
    const imagesToUpload: Array<{ base64Image: string; fileName: string }> = [];
    for (let sceneIndex = 0; sceneIndex < scenes.length; sceneIndex++) {
      const list = scenes[sceneIndex]?.imageUrls || [];
      for (let imageIndex = 0; imageIndex < list.length; imageIndex++) {
        const url: string = list[imageIndex];
        const base64Image = await toDataUri(url);
        if (typeof base64Image === 'string' && base64Image.startsWith('data:image/')) {
          imagesToUpload.push({
            base64Image,
            fileName: `scene-${sceneIndex}-${imageIndex}.jpeg`,
          });
        }
      }
    }

    if (imagesToUpload.length === 0) {
      return { message: 'No images to upload (using persisted images)', cached: true };
    }

    await Promise.all(
      imagesToUpload.map(image =>
        apiCall(API_ENDPOINTS.upload, { projectId, ...image }, 'Failed to upload image')
      )
    );
    return { message: `Uploaded ${imagesToUpload.length} images` };
  };

  const executeNarrate = async () => {
    const narrationScript = scenes.map((s: any) => s.narration).join(' ');
    return await apiCall(API_ENDPOINTS.narrate, 
      { projectId, narrationScript, emotion }, 
      'Failed to generate narration'
    );
  };

  const executeAlign = async () => {
    const narrateStep = steps.find(s => s.id === 'narrate');
    const gsAudioPath = narrateStep?.result?.gsAudioPath;
    
    if (!gsAudioPath) {
      throw new Error('No audio path from narration step');
    }

    return await apiCall(API_ENDPOINTS.align,
      { projectId, gsAudioPath },
      'Failed to align captions'
    );
  };

  const executeCompose = async () => {
    if (demoMode) {
      return { message: 'Compose skipped in demo mode', cached: true };
    }
    const narrationScript = scenes.map((s: any) => s.narration).join(' ');
    return await apiCall(API_ENDPOINTS.compose,
      { projectId, narrationScript },
      'Failed to compose music'
    );
  };

  const executeRender = async () => {
    const narrateStep = steps.find(s => s.id === 'narrate');
    const alignStep = steps.find(s => s.id === 'align');
    const composeStep = steps.find(s => s.id === 'compose');
    
    const gsAudioPath = narrateStep?.result?.gsAudioPath;
    const srtPath = alignStep?.result?.srtPath;
    const gsMusicPath = composeStep?.result?.gsMusicPath;

    if (!gsAudioPath || !srtPath) {
      throw new Error('Missing required assets for rendering');
    }

    const sceneDataForRender = scenes.map(scene => ({
      narration: scene.narration,
      imageCount: scene.imageUrls?.length || 0,
      camera: scene.camera || 'static',
      transition: scene.transition || 'fade',
      duration: scene.duration || 3,
    }));

    const narrationScript = scenes.map((s: any) => s.narration).join(' ');
    const totalSecs = Math.max(8, Math.round(scenes.reduce((s, sc) => s + (sc.duration || 3), 0)));
    try {
      const body: any = { projectId, scenes: sceneDataForRender, gsAudioPath, srtPath, gsMusicPath, useFal: false, force: true };
      if (autoGenerateClips !== undefined) body.autoGenerateClips = !!autoGenerateClips;
      if (forceClips) body.forceClips = true;
      if (clipSeconds && typeof clipSeconds === 'number') body.clipSeconds = clipSeconds;
      if (clipConcurrency) body.clipConcurrency = clipConcurrency;
      if (clipModel) body.clipModel = clipModel;
      return await apiCall(API_ENDPOINTS.render, body, 'Failed to render video');
    } catch (e) {
      // Retry without force if needed
      const bodyRetry: any = { projectId, scenes: sceneDataForRender, gsAudioPath, srtPath, gsMusicPath, useFal: false };
      if (autoGenerateClips !== undefined) bodyRetry.autoGenerateClips = !!autoGenerateClips;
      if (forceClips) bodyRetry.forceClips = true;
      if (clipSeconds && typeof clipSeconds === 'number') bodyRetry.clipSeconds = clipSeconds;
      if (clipConcurrency) bodyRetry.clipConcurrency = clipConcurrency;
      if (clipModel) bodyRetry.clipModel = clipModel;
      return await apiCall(API_ENDPOINTS.render, bodyRetry, 'Failed to render video (retry)');
    }
  };

  const executePolish = async () => {
    if (demoMode) return { message: 'Polish skipped in demo mode', cached: true };
    const polishEnabled = (import.meta as any)?.env?.VITE_ENABLE_POLISH === 'true';
    
    if (!proPolish || !polishEnabled) {
      return { message: 'Polish skipped (not enabled)', cached: true };
    }

    const renderStep = steps.find(s => s.id === 'render');
    const videoUrl = renderStep?.result?.videoUrl;
    
    if (!videoUrl) {
      throw new Error('No video URL from render step');
    }

    const currentUser = getCurrentUser();
    return await apiCall(API_ENDPOINTS.polish,
      { projectId, videoUrl, userId: currentUser?.uid },
      'Failed to polish video'
    );
  };

  // Skip step
  const skipStep = (stepId: string) => {
    updateStep(stepId, { status: 'skipped' });
    const nextIndex = steps.findIndex(s => s.id === stepId) + 1;
    if (nextIndex < steps.length) {
      setCurrentStepIndex(nextIndex);
    }
  };

  const getStepIcon = (step: WizardStep) => {
    switch (step.status) {
      case 'completed':
        return <Check className="w-5 h-5 text-green-500" />;
      case 'skipped':
        return <SkipForward className="w-5 h-5 text-yellow-500" />;
      case 'processing':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <div className="w-5 h-5 rounded-full border-2 border-gray-400" />;
    }
  };

  const getStepStatusColor = (step: WizardStep, index: number) => {
    if (step.status === 'completed') return 'bg-green-500';
    if (step.status === 'skipped') return 'bg-yellow-500';
    if (step.status === 'processing') return 'bg-blue-500';
    if (step.status === 'failed') return 'bg-red-500';
    if (index <= currentStepIndex) return 'bg-gray-600';
    return 'bg-gray-800';
  };

  const getCurrentStep = () => steps[currentStepIndex];
  const canExecute = (step: WizardStep) => step.status === 'pending' || step.status === 'failed';

  // Cloud Run logs link per step
  const logsLinkFor = (serviceName: string) => {
    const project = (import.meta as any)?.env?.VITE_FIREBASE_PROJECT_ID || 'reel-banana-35a54';
    const q = encodeURIComponent(`resource.type="cloud_run_revision"\nresource.labels.service_name="${serviceName}"`);
    return `https://console.cloud.google.com/logs/query;query=${q}?project=${project}`;
  };

  const serviceNameFor = (id: string): string => {
    switch (id) {
      case 'upload': return 'upload-assets';
      case 'narrate': return 'narrate';
      case 'align': return 'align-captions';
      case 'compose': return 'compose-music';
      case 'render': return 'render';
      case 'polish': return 'polish';
      default: return '';
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        const s = steps[currentStepIndex];
        if (s) executeStep(s.id);
      } else if (e.key === 'Enter' && e.shiftKey) {
        runAll();
      } else if (e.key === 'ArrowRight') {
        setCurrentStepIndex(i => Math.min(i + 1, steps.length - 1));
      } else if (e.key === 'ArrowLeft') {
        setCurrentStepIndex(i => Math.max(i - 1, 0));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [steps, currentStepIndex, runAll]);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-amber-500 text-black flex items-center justify-center"><Sparkles className="w-5 h-5" /></div>
          <div>
            <h1 className="text-2xl font-bold text-white">Movie Builder</h1>
            <p className="text-gray-400 text-sm">Per‑scene motion + captions + audio</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={runAll} className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-black font-semibold px-4 py-2 rounded">
            <PlayCircle className="w-4 h-4" /> One‑Click Build
          </button>
          <button onClick={() => setAutoMode(v => !v)} className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded">
            <Settings className="w-4 h-4" /> {autoMode ? 'Manual Mode' : 'Auto Mode'}
          </button>
          {onBack && (
            <button onClick={onBack} className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded">Back</button>
          )}
        </div>
      </div>

      {/* Scene gallery */}
      <div className="mb-6">
        <h2 className="text-white font-semibold mb-3">Scenes</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {scenes.map((scene, i) => {
            const thumb = (scene.imageUrls && scene.imageUrls[0]) || null;
            const clip = clipStatus[i];
            return (
              <div key={i} className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
                <div className="aspect-video relative bg-black">
                  {clip?.exists && clip.url ? (
                    <video src={clip.url} muted autoPlay loop playsInline className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500">
                      {thumb ? (
                        <img src={thumb} alt={`Scene ${i+1}`} className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <ImageIcon className="w-6 h-6" />
                          <span className="text-xs">No image</span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="absolute top-2 left-2 text-xs bg-black/60 text-white px-2 py-0.5 rounded">Scene {i+1}</div>
                  <div className="absolute bottom-2 left-2 text-xs px-2 py-0.5 rounded bg-amber-500 text-black">
                    {clip?.exists ? 'Motion: ready' : 'Motion: pending'}
                  </div>
                </div>
                <div className="p-2 text-xs text-gray-300 flex items-center justify-between">
                  <span>Duration: {scene.duration || 3}s</span>
                  <span className="text-gray-400">{(scene.camera || 'static')}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-gray-400">ETA: ~{remainingEta}</div>
          <div className="flex gap-2">
            <button onClick={() => setShowDetails(v => !v)} className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded">
              {showDetails ? 'Hide Details' : 'Show Details'}
            </button>
            {!autoMode && (
              <button onClick={runAll} className="text-xs bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 rounded">Run All</button>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between mb-3">
          {steps.map((step, index) => (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getStepStatusColor(step, index)} transition-colors`}>
                  {getStepIcon(step)}
                </div>
                <span className="text-xs text-gray-400 mt-2 text-center max-w-16">
                  {step.title}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 ${index < currentStepIndex ? 'bg-green-500' : 'bg-gray-700'}`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Current Step Details */}
      {getCurrentStep() && (
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-white">{getCurrentStep().title}</h2>
              <p className="text-gray-400">{getCurrentStep().description}</p>
            </div>
            <div className="flex items-center gap-3">{getStepIcon(getCurrentStep())}</div>
          </div>

          {/* Step Status */}
          {getCurrentStep().status === 'processing' && (
            <div className="text-blue-400 mb-4">Processing...</div>
          )}
          
          {getCurrentStep().status === 'completed' && (
            <div className="text-green-400 mb-4">✓ Completed successfully</div>
          )}
          
          {getCurrentStep().status === 'skipped' && (
            <div className="text-yellow-400 mb-4">⏭ Skipped (using cached result)</div>
          )}
          
          {getCurrentStep().status === 'failed' && (
            <div className="text-red-400 mb-4">✗ Failed: {getCurrentStep().error}</div>
          )}

          {/* Step Actions */}
          {autoMode ? (
            <div className="text-gray-400 text-sm">Automatic mode is enabled. Click “One‑Click Build” to run all steps.</div>
          ) : (
            <div className="flex gap-3">
              {canExecute(getCurrentStep()) && (
                <button
                  onClick={() => executeStep(getCurrentStep().id)}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <Play className="w-4 h-4" />
                  {getCurrentStep().status === 'failed' ? 'Retry' : 'Execute'}
                </button>
              )}
              {getCurrentStep().status === 'pending' && getCurrentStep().id !== 'upload' && getCurrentStep().id !== 'narrate' && (
                <button
                  onClick={() => skipStep(getCurrentStep().id)}
                  className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <SkipForward className="w-4 h-4" />
                  Skip
                </button>
              )}
            </div>
          )}

          {/* Render configuration: per-scene motion clips */}
          {getCurrentStep().id === 'render' && (
            <div className="mt-6 space-y-3 text-sm">
              <div className="text-gray-300 font-medium">Motion Clips (Veo 3 i2v)</div>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-gray-300">
                  <input type="checkbox" checked={autoGenerateClips} onChange={(e)=>setAutoGenerateClips(e.target.checked)} />
                  Auto-generate clips per scene (default)
                </label>
                <label className="flex items-center gap-2 text-gray-300">
                  <input type="checkbox" checked={forceClips} onChange={(e)=>setForceClips(e.target.checked)} />
                  Force regenerate
                </label>
                <div className="flex items-center gap-2 text-gray-300">
                  <span>Seconds/clip</span>
                  <input
                    type="number"
                    min={2}
                    max={20}
                    value={clipSeconds === '' ? '' : clipSeconds}
                    placeholder="(scene duration)"
                    onChange={(e)=>{
                      const v = e.target.value;
                      setClipSeconds(v === '' ? '' : Math.max(2, Math.min(20, parseInt(v||'0',10)||0)));
                    }}
                    className="w-28 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white"
                  />
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <span>Concurrency</span>
                  <input
                    type="number"
                    min={1}
                    max={4}
                    value={clipConcurrency}
                    onChange={(e)=>setClipConcurrency(Math.max(1, Math.min(4, parseInt(e.target.value||'2',10)||2)))}
                    className="w-20 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white"
                  />
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <span>Model</span>
                  <select
                    value={clipModel}
                    onChange={(e)=>setClipModel(e.target.value)}
                    className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white"
                  >
                    <option value="fal-ai/veo3/fast/image-to-video">Veo 3 Fast (i2v)</option>
                    <option value="fal-ai/ltxv-13b-098-distilled/image-to-video">LTXV 13B (i2v)</option>
                  </select>
                </div>
              </div>
              <p className="text-xs text-gray-500">Clips are generated per scene, then stitched with captions and narration. Leave Seconds/clip empty to use each scene's duration.</p>
            </div>
          )}

          {/* Step Result */}
          {showDetails && getCurrentStep().result && (
            <div className="mt-4 p-3 bg-gray-700 rounded text-sm text-gray-300">
              <strong>Result:</strong> {JSON.stringify(getCurrentStep().result, null, 2)}
            </div>
          )}
        </div>
      )}

      {/* Render Settings */}
      <div className="bg-gray-800 rounded-lg p-6 mt-6">
        <h3 className="text-lg font-semibold text-white mb-4">Render Settings</h3>
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-300">
          <label className="flex items-center gap-2"><input type="checkbox" checked={autoGenerateClips} onChange={(e)=>setAutoGenerateClips(e.target.checked)} /> Auto-generate motion clips</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={forceClips} onChange={(e)=>setForceClips(e.target.checked)} /> Force regenerate clips</label>
          <div className="flex items-center gap-2"><span>Seconds/clip</span><input type="number" min={2} max={20} value={clipSeconds === '' ? '' : clipSeconds} placeholder="(scene duration)" onChange={(e)=>{ const v=e.target.value; setClipSeconds(v===''?'':Math.max(2,Math.min(20,parseInt(v||'0',10)||0))); }} className="w-28 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white" /></div>
          <div className="flex items-center gap-2"><span>Concurrency</span><input type="number" min={1} max={4} value={clipConcurrency} onChange={(e)=>setClipConcurrency(Math.max(1,Math.min(4,parseInt(e.target.value||'2',10)||2)))} className="w-20 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white" /></div>
          <div className="flex items-center gap-2"><span>Model</span><select value={clipModel} onChange={(e)=>setClipModel(e.target.value)} className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white"><option value="fal-ai/veo3/fast/image-to-video">Veo 3 Fast (i2v)</option><option value="fal-ai/ltxv-13b-098-distilled/image-to-video">LTXV 13B (i2v)</option></select></div>
        </div>
      </div>
    </div>
  );
};

export default MovieWizard;
