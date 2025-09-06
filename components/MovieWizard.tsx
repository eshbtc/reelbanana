import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useConfirm } from './ConfirmProvider';
import { getFirestore, collection, addDoc, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { firebaseApp } from '../lib/firebase';
import { getCurrentUser as getUser } from '../services/authService';
import { Check, Play, Loader2, AlertCircle, SkipForward } from 'lucide-react';
import { API_ENDPOINTS, apiCall } from '../config/apiConfig';
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
  onFail 
}) => {
  const [steps, setSteps] = useState<WizardStep[]>(() =>
    WIZARD_STEPS.map(step => ({
      ...step,
      status: 'pending' as const,
    }))
  );
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [showDetails, setShowDetails] = useState(false);

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

  // Resume wizard state
  useEffect(() => {
    (async () => {
      try {
        const key = `wizard:${projectId}`;
        const raw = sessionStorage.getItem(key);
        if (!raw) return;
        const saved = JSON.parse(raw);
        if (saved && Array.isArray(saved.steps)) {
          const ok = await confirm({ title: 'Resume Wizard?', message: 'Resume previous wizard session?', confirmText: 'Resume', cancelText: 'Start Fresh' });
          if (ok) {
            setSteps(saved.steps);
            if (typeof saved.currentStepIndex === 'number') setCurrentStepIndex(saved.currentStepIndex);
          } else {
            sessionStorage.removeItem(key);
          }
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
    // Filter for data URI images only (HTTPS images are already persisted)
    const imagesToUpload = scenes.flatMap((scene, sceneIndex) =>
      (scene.imageUrls || [])
        .filter((url: string) => url.startsWith('data:image/'))
        .map((url: string, imageIndex: number) => ({
          base64Image: url,
          fileName: `scene-${sceneIndex}-${imageIndex}.jpeg`,
        }))
    );

    if (imagesToUpload.length === 0) {
      return { message: 'No images to upload (using persisted images)', cached: true };
    }

    const uploadPromises = imagesToUpload.map(image =>
      apiCall(API_ENDPOINTS.upload, { projectId, ...image }, 'Failed to upload image')
    );
    
    await Promise.all(uploadPromises);
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

    return await apiCall(API_ENDPOINTS.render,
      { projectId, scenes: sceneDataForRender, gsAudioPath, srtPath, gsMusicPath },
      'Failed to render video'
    );
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
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-white mb-8 text-center">Movie Production Wizard</h1>
      
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-gray-400">ETA: ~{remainingEta}</div>
          <div className="flex gap-2">
            <button onClick={() => setShowDetails(v => !v)} className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded">
              {showDetails ? 'Hide Details' : 'Show Details'}
            </button>
            <button onClick={runAll} className="text-xs bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 rounded">Run All</button>
          </div>
        </div>
        <div className="flex items-center justify-between mb-4">
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
            <div className="flex items-center gap-3">
              <a
                href={logsLinkFor(serviceNameFor(getCurrentStep().id))}
                target="_blank"
                rel="noreferrer"
                className="text-emerald-400 hover:text-emerald-300 text-xs"
              >Logs ↗</a>
              {getStepIcon(getCurrentStep())}
            </div>
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

          {/* Step Result */}
          {showDetails && getCurrentStep().result && (
            <div className="mt-4 p-3 bg-gray-700 rounded text-sm text-gray-300">
              <strong>Result:</strong> {JSON.stringify(getCurrentStep().result, null, 2)}
            </div>
          )}
        </div>
      )}

      {/* All Steps Overview */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">All Steps</h3>
        <div className="space-y-3">
          {steps.map((step, index) => (
            <div key={step.id} className={`flex items-center justify-between p-3 rounded ${index === currentStepIndex ? 'bg-gray-700' : 'bg-gray-750'}`}>
              <div className="flex items-center gap-3">
                {getStepIcon(step)}
                <div>
                  <div className="text-white font-medium">{step.title}</div>
                  <div className="text-gray-400 text-sm">{step.description}</div>
                </div>
              </div>
              <div className="text-sm text-gray-400 capitalize">{step.status}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MovieWizard;
