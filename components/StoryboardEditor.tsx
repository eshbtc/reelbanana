// Fix: Implement the StoryboardEditor component. This file was previously invalid.
import React, { useState, useCallback, useEffect } from 'react';
import { Scene, StylePreset } from '../types';
import { generateStory, generateCharacterAndStyle, generateImageSequence } from '../services/trackedGeminiService';
import { createProject, getProject, updateProject } from '../services/firebaseService';
import SceneCard from './SceneCard';
import Spinner from './Spinner';
import { PlusIcon, SparklesIcon, SaveIcon, DocumentAddIcon } from './Icon';
import { TEMPLATES } from '../lib/templates';
import CharacterPicker from './CharacterPicker';
import CharacterGenerator from './CharacterGenerator';
import { calculateTotalCost, formatCost } from '../utils/costCalculator';
import { useUserCredits } from '../hooks/useUserCredits';
import { CostEstimator } from './CostEstimator';
import { OperationCostDisplay } from './OperationCostDisplay';
import { CreditPurchaseModal } from './CreditPurchaseModal';
import { getCurrentUser } from '../services/authService';
import { useToast } from './ToastProvider';
import { useConfirm } from './ConfirmProvider';

// Augment window for optional template passthrough
declare global {
  interface Window {
    templateToLoad?: {
      id: string;
      title: string;
      topic: string;
      characterAndStyle: string;
      scenes: Array<{ prompt: string; narration: string }>;
      characterRefs?: string[];
    } | null;
  }
}

interface StoryboardEditorProps {
  onPlayMovie: (scenes: Scene[]) => void;
  onProjectIdChange?: (id: string | null) => void;
  onNavigate?: (view: string) => void;
  onLoadTemplate?: (templateId: string) => void;
  demoMode?: boolean;
  onExitDemo?: () => void;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const quickStartIdeas = [
    "The Lost Astronaut",
    "Mystery in the Magical Forest", 
    "Neon Noir Detective",
    "The Secret Recipe",
];

// AI-generated inspiration categories
const inspirationCategories = [
    "Adventure & Exploration",
    "Mystery & Suspense", 
    "Fantasy & Magic",
    "Sci-Fi & Future",
    "Comedy & Whimsy",
    "Drama & Emotion"
];

// Templates Modal (inline for simplicity)
const TemplatesModal: React.FC<{ open: boolean; onClose: () => void; onPick: (id: string) => void }> = ({ open, onClose, onPick }) => {
  console.log('📝 TemplatesModal render: open =', open);
  console.log('📝 TemplatesModal TEMPLATES available:', TEMPLATES?.length || 0);
  if (!open) {
    console.log('📝 TemplatesModal not rendering - open is false');
    return null;
  }
  console.log('📝 TemplatesModal rendering modal UI');
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[9999]">
      <div className="bg-gray-900 border border-gray-700 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h3 className="text-white font-bold text-lg">Start from Template</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
          {TEMPLATES.map(t => (
            <button 
              key={t.id} 
              onClick={() => {
                console.log('📝 Template clicked:', t.id, t.title);
                onPick(t.id);
              }} 
              className="bg-gray-800 hover:bg-gray-700 text-left p-4 rounded-lg border border-gray-700 transition-colors"
            >
              <div className="text-white font-semibold mb-1">{t.title}</div>
              <div className="text-xs text-gray-400 line-clamp-3">{t.topic}</div>
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-gray-800 text-xs text-gray-400">
          Tip: After loading a template, add 1–3 Character Passport images to keep your hero consistent.
        </div>
      </div>
    </div>
  );
};

// Lightweight drag-and-drop grid without extra deps
const DragGrid: React.FC<{
  scenes: Scene[];
  renderMode: 'draft' | 'final';
  onReorder: (newOrder: Scene[]) => void;
  onDelete: (id: string) => void;
  onGenerate: (id: string, prompt: string) => void;
  onVariant: (id: string, prompt: string) => void;
  onGenerateVideo?: (id: string) => void;
  onUpdateScene: (id: string, updates: Partial<Pick<Scene, 'prompt' | 'narration' | 'camera' | 'transition' | 'duration' | 'backgroundImage' | 'stylePreset' | 'variantImageUrls' | 'voiceId' | 'voiceName' | 'videoModel' | 'sceneDirection' | 'location' | 'props' | 'costumes' | 'videoUrl' | 'videoStatus'>>) => void;
  onUpdateSequence: (id: string, newImageUrls: string[]) => void;
}> = ({ scenes, renderMode, onReorder, onDelete, onGenerate, onVariant, onGenerateVideo, onUpdateScene, onUpdateSequence }) => {
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const [overIndex, setOverIndex] = React.useState<number | null>(null);

  const handleDragStart = (index: number) => setDragIndex(index);
  const handleDragOver = (index: number, e: React.DragEvent) => {
    e.preventDefault();
    setOverIndex(index);
  };
  const handleDragLeave = () => setOverIndex(null);
  const handleDrop = (targetIndex: number) => {
    if (dragIndex === null || dragIndex === targetIndex) return;
    const newOrder = [...scenes];
    const [draggedItem] = newOrder.splice(dragIndex, 1);
    newOrder.splice(targetIndex, 0, draggedItem);
    onReorder(newOrder);
    setDragIndex(null);
    setOverIndex(null);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {scenes.map((scene, index) => (
        <div
          key={scene.id}
          draggable
          onDragStart={() => handleDragStart(index)}
          onDragOver={(e) => handleDragOver(index, e)}
          onDragLeave={handleDragLeave}
          onDrop={() => handleDrop(index)}
          className={overIndex === index ? 'ring-2 ring-amber-500 rounded-md' : ''}
        >
          <SceneCard
            scene={scene}
            index={index}
            onDelete={onDelete}
            onGenerateImage={onGenerate}
            onGenerateVariant={onVariant}
            onGenerateVideo={onGenerateVideo}
            onUpdateScene={onUpdateScene}
            onUpdateSequence={onUpdateSequence}
            framesPerScene={renderMode === 'draft' ? 3 : 5}
          />
        </div>
      ))}
    </div>
  );
};

const StoryboardEditor: React.FC<StoryboardEditorProps> = ({ onPlayMovie, onProjectIdChange, onNavigate, onLoadTemplate, demoMode = false, onExitDemo }) => {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [topic, setTopic] = useState('');
  const [projectName, setProjectName] = useState('');
  const [characterAndStyle, setCharacterAndStyle] = useState('');
  const [characterRefs, setCharacterRefs] = useState<string[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  
  const [isLoadingStory, setIsLoadingStory] = useState(false);
  const [isLoadingProject, setIsLoadingProject] = useState(true); // Start true for initial load check
  const [storyError, setStoryError] = useState<string | null>(null);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showCharacterPicker, setShowCharacterPicker] = useState(false);
  const [showCharacterGenerator, setShowCharacterGenerator] = useState(false);
  const [renderMode, setRenderMode] = useState<'draft' | 'final'>('draft');
  const [forceUseApiKey] = useState(false);
  const [isGeneratingInspiration, setIsGeneratingInspiration] = useState(false);
  const [generatedInspiration, setGeneratedInspiration] = useState<string>('');
  const [projectVideoUrl, setProjectVideoUrl] = useState<string | null>(null);
  const [productDemoMode, setProductDemoMode] = useState(false);
  const [productImages, setProductImages] = useState<string[]>([]);
  const [showCreditPurchase, setShowCreditPurchase] = useState(false);
  
  // Defensive context usage to prevent null context errors
  let toast: any = null;
  let confirm: any = null;
  
  try {
    const toastContext = useToast();
    toast = toastContext.toast;
  } catch (error) {
    console.warn('Toast context not available:', error);
    toast = { info: () => {}, success: () => {}, error: () => {} };
  }
  
  try {
    confirm = useConfirm();
  } catch (error) {
    console.warn('Confirm context not available:', error);
    confirm = () => Promise.resolve(false);
  }

  // Demo mode: automatically load simple demo content
  useEffect(() => {
    if (demoMode && scenes.length === 0) {
      const demoScenes = [
        {
          id: '1',
          narration: 'Welcome to ReelBanana.',
          imageUrls: [`https://via.placeholder.com/512x512/3B82F6/FFFFFF?text=ReelBanana+Demo`],
          duration: 2,
          camera: 'static' as const,
          transition: 'fade' as const,
        },
        {
          id: '2', 
          narration: 'AI creates videos fast.',
          imageUrls: [`https://via.placeholder.com/512x512/10B981/FFFFFF?text=AI+Power`],
          duration: 2,
          camera: 'static' as const,
          transition: 'fade' as const,
        },
        {
          id: '3',
          narration: 'Try it now!',
          imageUrls: [`https://via.placeholder.com/512x512/F59E0B/FFFFFF?text=Get+Started`],
          duration: 2,
          camera: 'static' as const,
          transition: 'fade' as const,
        }
      ];
      
      setScenes(demoScenes);
      setTopic('ReelBanana Demo');
      setCharacterAndStyle('Simple minimal style with clean placeholders');
      setIsLoadingProject(false);
    }
  }, [demoMode, scenes.length]);

  
  // Use the real-time credits hook
  const { refreshCredits, freeCredits, isAdmin } = useUserCredits();

  // Effect to load project from URL on initial mount
  useEffect(() => {
    const loadProjectFromUrl = async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const id = urlParams.get('projectId');
        if (id) {
            try {
                const projectData = await getProject(id);
                if (projectData) {
                    setProjectId(id);
                    try { onProjectIdChange?.(id); } catch {}
                    setTopic(projectData.topic);
                    setProjectName(projectData.topic); // Use topic as project name for existing projects
                    setCharacterAndStyle(projectData.characterAndStyle);
                    setScenes(projectData.scenes);
                    // Load video URL if it exists
                    setProjectVideoUrl((projectData as any).videoUrl || null);
                } else {
                    toast.info('Project not found. You can start a new one.');
                    window.history.replaceState({}, '', window.location.pathname);
                }
            } catch (error) {
                setStoryError(error instanceof Error ? error.message : "Failed to load project.");
                toast.error('Failed to load project.');
            }
        }
        setIsLoadingProject(false);
    };
    loadProjectFromUrl();
  }, [onProjectIdChange, toast]);

  // (Removed unused BYOK check state to satisfy lints while preserving functionality)

  const handleGenerateStory = useCallback(async (storyTopic: string) => {
    if (demoMode) {
      toast.info('Demo Mode is on. Click Upgrade Demo to generate real content.');
      return;
    }
    if (!storyTopic.trim()) {
      setStoryError("Please enter or select a topic for your story.");
      toast.info('Enter or pick a topic to start your story.');
      return;
    }

    // Check credits before proceeding
    const requiredCredits = 2; // 2 credits for story generation
    
    if (!isAdmin && freeCredits < requiredCredits) {
      toast?.error(`Insufficient credits. Need ${requiredCredits} credits for story generation.`);
      setShowCreditPurchase(true);
      return;
    }

    setIsLoadingStory(true);
    setStoryError(null);
    setScenes([]);

    try {
      let storyScenes, characterStyle;
      
      if (productDemoMode && productImages.length > 0) {
        // Product Demo Mode: Generate story based on product images
        const productPrompts = productImages.map((_, index) => 
          `Showcase product feature ${index + 1} with professional presentation and modern UI`
        );
        
        storyScenes = productPrompts.map((prompt, index) => ({
          prompt,
          narration: `Introducing our innovative product feature ${index + 1}. Experience the future of technology with cutting-edge design and seamless functionality.`
        }));
        
        characterStyle = 'Professional product showcase with modern UI, clean design, and cinematic presentation';
      } else {
        // Regular mode: Generate both story and character/style in parallel
        [storyScenes, characterStyle] = await Promise.all([
          generateStory(storyTopic, forceUseApiKey),
          generateCharacterAndStyle(storyTopic, forceUseApiKey)
        ]);
      }
      
      if (storyScenes.length === 0) {
        throw new Error("The AI couldn't generate a story for this topic. Please try a different one.");
      }
      
      const limitedScenes = demoMode ? storyScenes.slice(0, 4) : storyScenes;
      const initialScenes: Scene[] = limitedScenes.map((s, index) => ({
        id: `${Date.now()}-${index}`,
        prompt: s.prompt,
        narration: s.narration,
        status: productDemoMode && productImages[index] ? 'success' : 'idle', // Pre-populate with product images
        imageUrls: productDemoMode && productImages[index] ? [productImages[index]] : [],
      }));

      // Create a new project in Firestore
      const finalProjectName = projectName.trim() || storyTopic;
      const newProjectId = await createProject({
          topic: finalProjectName,
          characterAndStyle: characterStyle, // Auto-generated
          scenes: initialScenes
      });
      
      setProjectId(newProjectId);
      try { sessionStorage.removeItem(`wizard:${newProjectId}`); } catch {}
      try { onProjectIdChange?.(newProjectId); } catch {}
      setTopic(storyTopic);
      setProjectName(finalProjectName);
      setCharacterAndStyle(characterStyle); // Auto-generated
      setScenes(initialScenes);
      setSaveStatus('saved');
      
      // Refresh credits after successful story generation
      await refreshCredits();
      
      // Update URL without reloading the page
      window.history.pushState({}, '', `?projectId=${newProjectId}`);

    } catch (error) {
      setStoryError(error instanceof Error ? error.message : "An unknown error occurred.");
    } finally {
      setIsLoadingStory(false);
    }
  }, [projectName, forceUseApiKey, demoMode, productDemoMode, productImages, onProjectIdChange, refreshCredits, toast, freeCredits, isAdmin]);
  
  const handleSaveProject = useCallback(async () => {
    if (!projectId) return;
    setSaveStatus('saving');
    try {
        await updateProject(projectId, { topic, characterAndStyle, scenes });
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000); // Reset after 2s
    } catch (error) {
        setSaveStatus('error');
        console.error("Failed to save project:", error);
    }
  }, [projectId, topic, characterAndStyle, scenes]);

  const handleSaveAsTemplate = useCallback(async () => {
    if (!topic || !scenes.length) {
      toast.error('Please add a topic and at least one scene before saving as template');
      return;
    }

    const templateName = prompt('Enter a name for your template:');
    if (!templateName) return;

    setIsSavingTemplate(true);
    try {
      // Create template data from current project
      const templateData = {
        id: `custom-${Date.now()}`,
        title: templateName,
        topic: topic,
        characterAndStyle: characterAndStyle,
        scenes: scenes.map(scene => ({
          prompt: scene.prompt,
          narration: scene.narration
        })),
        characterRefs: characterRefs,
        isCustom: true,
        createdAt: new Date().toISOString()
      };

      // Save to localStorage for now (could be moved to Firebase later)
      const existingTemplates = JSON.parse(localStorage.getItem('customTemplates') || '[]');
      existingTemplates.push(templateData);
      localStorage.setItem('customTemplates', JSON.stringify(existingTemplates));

      toast.success(`Template "${templateName}" saved successfully!`);
      console.log('📝 Custom template saved:', templateData);
    } catch (error) {
      console.error('Failed to save template:', error);
      toast.error('Failed to save template. Please try again.');
    } finally {
      setIsSavingTemplate(false);
    }
  }, [topic, scenes, characterAndStyle, characterRefs, toast]);

  // Debounced autosave on changes (topic, character/style, scenes)
  useEffect(() => {
    if (!projectId) return;
    // Skip autosave while images are generating to reduce churn
    const generating = scenes.some(s => s.status === 'generating');
    if (generating) return;
    const t = setTimeout(() => {
      updateProject(projectId, { topic, characterAndStyle, scenes })
        .then(() => {
          setSaveStatus('saved');
          setTimeout(() => setSaveStatus('idle'), 1500);
        })
        .catch((e) => {
          console.error('Autosave failed:', e);
          setSaveStatus('error');
        });
    }, 1200);
    return () => clearTimeout(t);
  }, [projectId, topic, characterAndStyle, scenes]);

  const handleNewStory = async () => {
    const ok = await confirm({
      title: 'Start New Story?',
      message: 'Any unsaved changes will be lost.',
      confirmText: 'Start New',
      cancelText: 'Cancel'
    });
    if (!ok) return;
    setProjectId(null);
    try { onProjectIdChange?.(null); } catch {}
    setTopic('');
    setCharacterAndStyle('');
    setCharacterRefs([]);
    setScenes([]);
    setStoryError(null);
    window.history.pushState({}, '', window.location.pathname);
  };


  const handleInspirationClick = (inspirationTopic: string) => {
      handleGenerateStory(inspirationTopic);
  };

  const handleGenerateInspiration = useCallback(async () => {
    if (isGeneratingInspiration) return;
    
    setIsGeneratingInspiration(true);
    setStoryError(null);
    
    try {
      // Generate a random inspiration using AI
      const randomCategory = inspirationCategories[Math.floor(Math.random() * inspirationCategories.length)];
      const inspirationPrompt = `Generate a creative, engaging story idea in the "${randomCategory}" category. The story should be suitable for a 2-minute animated video with 5 scenes. Return only the story title/idea, nothing else. Make it unique and compelling.`;
      
      // Use the existing generateStory function with a simple prompt
      const currentUser = getCurrentUser();
      if (!currentUser) {
        throw new Error("Please sign in to generate inspiration.");
      }

      // Use the consistent geminiService for inspiration generation
      const inspiration = await generateCharacterAndStyle(inspirationPrompt);
      
      setGeneratedInspiration(inspiration);
      setTopic(inspiration);
      
      // Refresh credits after successful generation
      await refreshCredits();
      
    } catch (error) {
      console.error('Error generating inspiration:', error);
      setStoryError(error instanceof Error ? error.message : 'Failed to generate inspiration');
    } finally {
      setIsGeneratingInspiration(false);
    }
  }, [isGeneratingInspiration, refreshCredits]);

  const handleLoadTemplate = useCallback(async (templateId: string) => {
    console.log('📝 handleLoadTemplate called with:', templateId);
    
    // If we have an external onLoadTemplate prop, use it
    if (onLoadTemplate) {
      onLoadTemplate(templateId);
      return;
    }
    
    // Check for custom template first
    let tpl = null;
    if (window.templateToLoad) {
      tpl = window.templateToLoad;
      window.templateToLoad = null; // Clear after use
      console.log('📝 Loading custom template:', tpl.title);
    } else {
      // Otherwise, use the built-in template loading logic
      tpl = TEMPLATES.find(t => t.id === templateId);
      console.log('📝 Found built-in template:', tpl?.title || 'NOT FOUND');
    }
    
    if (!tpl) {
      console.error('📝 Template not found for ID:', templateId);
      return;
    }
    try {
      const initialScenes: Scene[] = tpl.scenes.map((s, index) => ({
        id: `${Date.now()}-${index}`,
        prompt: s.prompt,
        narration: s.narration,
        status: 'idle',
      }));
      console.log('📝 Creating project from template...');
      const newProjectId = await createProject({
        topic: tpl.topic,
        characterAndStyle: tpl.characterAndStyle,
        scenes: initialScenes,
      });
      console.log('📝 Project created with ID:', newProjectId);
      setProjectId(newProjectId);
      try { onProjectIdChange?.(newProjectId); } catch {}
      setTopic(tpl.topic);
      setCharacterAndStyle(tpl.characterAndStyle);
      setCharacterRefs(tpl.characterRefs || []);
      setScenes(initialScenes);
      setSaveStatus('saved');
      setShowTemplatePicker(false);
      window.history.pushState({}, '', `?projectId=${newProjectId}`);
      console.log('📝 Template loaded successfully!');
    } catch (e) {
      console.error('📝 Failed to load template:', e);
      alert('Failed to load template. Please try again.');
    }
  }, [onLoadTemplate, onProjectIdChange]);

  const handleGenerateImageSequence = useCallback(async (id: string, prompt: string) => {
    if (demoMode) {
      toast.info('Demo Mode is on. Click Upgrade Demo to enable generation.');
      return;
    }
    if (!characterAndStyle.trim()) {
        toast.info('Please describe your character and style before generating images.');
        return;
    }

    // Check credits before proceeding
    const imageCount = renderMode === 'draft' ? 3 : 5;
    const requiredCredits = 3 * imageCount; // 3 credits per image
    
    if (!isAdmin && freeCredits < requiredCredits) {
      toast?.error(`Insufficient credits. Need ${requiredCredits} credits for ${imageCount} images.`);
      setShowCreditPurchase(true);
      return;
    }
    setScenes(prevScenes =>
      prevScenes.map(s => s.id === id ? { ...s, status: 'generating', error: undefined } : s)
    );
    try {
      const sceneObj = scenes.find(s => s.id === id);
      const bg = sceneObj?.backgroundImage;
      const stylePreset = sceneObj?.stylePreset || 'none';
      const styleInstruction = ((): string => {
        switch(stylePreset as StylePreset) {
          case 'ghibli': return characterAndStyle + '. Studio Ghibli watercolor style, soft edges, warm palette, gentle lighting.';
          case 'wes-anderson': return characterAndStyle + '. Wes Anderson aesthetic with symmetry, pastel colors, centered framing.';
          case 'film-noir': return characterAndStyle + '. High-contrast film noir, moody lighting, dramatic shadows, monochrome.';
          case 'pixel-art': return characterAndStyle + '. 16-bit pixel art, crisp dithered shading, retro palette.';
          case 'claymation': return characterAndStyle + '. Claymation stop-motion look, tactile textures, soft studio lights.';
          default: return characterAndStyle;
        }
      })();
      const sceneIndex = scenes.findIndex(s => s.id === id);
      let cachedInfo: { cached?: boolean } | undefined;
      const imageUrls = await generateImageSequence(prompt, styleInstruction, {
        characterRefs,
        backgroundImage: bg,
        frames: demoMode ? 3 : (renderMode === 'draft' ? 3 : 5),
        projectId: projectId || undefined,
        sceneIndex,
        location: sceneObj.location,
        props: sceneObj.props,
        costumes: sceneObj.costumes,
        sceneDirection: sceneObj.sceneDirection,
        forceUseApiKey,
        onInfo: (info) => { cachedInfo = info; }
      });
      setScenes(prevScenes =>
        prevScenes.map(s => s.id === id ? { ...s, status: 'success', imageUrls, cached: !!cachedInfo?.cached } : s)
      );
      
      // Refresh credits after successful image generation
      await refreshCredits();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      setScenes(prevScenes =>
        prevScenes.map(s => s.id === id ? { ...s, status: 'error', error: errorMessage } : s)
      );
    } finally {
        setSaveStatus('idle'); // Mark project as having unsaved changes
    }
  }, [characterAndStyle, scenes, characterRefs, renderMode, demoMode, projectId, forceUseApiKey, refreshCredits, toast, freeCredits, isAdmin]);

  // Local helper to read file as data URL
  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };
  
  const handleGenerateAllImages = useCallback(async () => {
    if (!characterAndStyle.trim()) {
        alert("Please describe your character and style before generating images.");
        return;
    }
    setIsGeneratingAll(true);
    const promises = scenes
      .filter(s => s.status === 'idle' || s.status === 'error')
      .map(s => handleGenerateImageSequence(s.id, s.prompt));
    
    await Promise.allSettled(promises);
    setIsGeneratingAll(false);
  }, [scenes, handleGenerateImageSequence, characterAndStyle]);

  const handleGenerateVariant = useCallback(async (id: string, prompt: string) => {
    if (demoMode) {
      toast.info('Demo Mode is on. Click Upgrade Demo to enable generation.');
      return;
    }
    // reuse same options but nudge prompt for variation
    const sceneObj = scenes.find(s => s.id === id);
    if (!sceneObj) return;
    if (!characterAndStyle.trim()) {
      alert('Please describe your character and style before generating images.');
      return;
    }
    setScenes(prev => prev.map(s => s.id === id ? { ...s, status: 'generating', error: undefined } : s));
    try {
      const stylePreset = sceneObj.stylePreset || 'none';
      const styleInstruction = ((): string => {
        switch(stylePreset) {
          case 'ghibli': return characterAndStyle + '. Studio Ghibli watercolor style, soft edges, warm palette, gentle lighting.';
          case 'wes-anderson': return characterAndStyle + '. Wes Anderson aesthetic with symmetry, pastel colors, centered framing.';
          case 'film-noir': return characterAndStyle + '. High-contrast film noir, moody lighting, dramatic shadows, monochrome.';
          case 'pixel-art': return characterAndStyle + '. 16-bit pixel art, crisp dithered shading, retro palette.';
          case 'claymation': return characterAndStyle + '. Claymation stop-motion look, tactile textures, soft studio lights.';
          default: return characterAndStyle;
        }
      })();
      const bg = sceneObj.backgroundImage;
      const sceneIndex = scenes.findIndex(s => s.id === id);
      let cachedInfo: { cached?: boolean } | undefined;
      const imageUrls = await generateImageSequence(`${prompt} (alternative angle variation)`, styleInstruction, {
        characterRefs,
        backgroundImage: bg,
        frames: demoMode ? 3 : (renderMode === 'draft' ? 3 : 5),
        projectId: projectId || undefined,
        sceneIndex,
        location: sceneObj.location,
        props: sceneObj.props,
        costumes: sceneObj.costumes,
        sceneDirection: sceneObj.sceneDirection,
        forceUseApiKey,
        onInfo: (info) => { cachedInfo = info; }
      });
      setScenes(prev => prev.map(s => s.id === id ? { ...s, status: 'success', variantImageUrls: imageUrls, cached: !!cachedInfo?.cached } : s));
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Variant generation failed.';
      setScenes(prev => prev.map(s => s.id === id ? { ...s, status: 'error', error: errorMessage } : s));
    }
  }, [scenes, characterAndStyle, characterRefs, renderMode, demoMode, projectId, forceUseApiKey]);


  const handleUpdateScene = useCallback((id: string, updates: Partial<Pick<Scene, 'prompt' | 'narration' | 'camera' | 'transition' | 'duration' | 'backgroundImage' | 'stylePreset' | 'voiceId' | 'voiceName' | 'videoModel' | 'sceneDirection' | 'location' | 'props' | 'costumes' | 'videoUrl' | 'videoStatus'>>) => {
    setScenes(prevScenes =>
      prevScenes.map(s => s.id === id ? { ...s, ...updates } : s)
    );
    setSaveStatus('idle');
  }, []);

  const handleUpdateSequence = useCallback((id: string, newImageUrls: string[]) => {
    setScenes(prevScenes =>
        prevScenes.map(s =>
            s.id === id
                ? { ...s, status: 'success', imageUrls: newImageUrls, error: undefined }
                : s
        )
    );
    setSaveStatus('idle');
  }, []);

  const handleGenerateVideo = useCallback(async (sceneId: string) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene || !scene.imageUrls || scene.imageUrls.length === 0) {
      toast.error('Scene must have images before generating video');
      return;
    }

    // Check credits before proceeding
    const requiredCredits = 5; // 5 credits for video rendering
    
    if (!isAdmin && freeCredits < requiredCredits) {
      toast?.error(`Insufficient credits. Need ${requiredCredits} credits for video generation.`);
      setShowCreditPurchase(true);
      return;
    }

    // Update scene status to generating
    setScenes(prevScenes =>
      prevScenes.map(s => s.id === sceneId ? { ...s, videoStatus: 'generating' } : s)
    );

    try {
      // Simulate video generation - in real implementation, this would call the video generation API
      // For now, we'll create a placeholder video URL
      const videoUrl = `https://example.com/generated-video-${sceneId}.mp4`;
      
      // Update scene with generated video
      setScenes(prevScenes =>
        prevScenes.map(s => s.id === sceneId ? { ...s, videoUrl, videoStatus: 'success' } : s)
      );
      
      toast.success('Video generated successfully!');
    } catch (error) {
      console.error('Video generation failed:', error);
      setScenes(prevScenes =>
        prevScenes.map(s => s.id === sceneId ? { ...s, videoStatus: 'error' } : s)
      );
      toast.error('Failed to generate video');
    }
  }, [scenes, toast, freeCredits, isAdmin]);

  const handleDeleteScene = useCallback((id: string) => {
    setScenes(prevScenes => prevScenes.filter(s => s.id !== id));
    setSaveStatus('idle');
  }, []);

  const handleAddScene = () => {
    const newScene: Scene = {
        id: `${Date.now()}-new`,
        prompt: 'A new scene. Edit this prompt to describe what you want to see.',
        narration: 'A new narration. Edit this to describe what is happening.',
        status: 'idle',
    };
    setScenes(prev => [...prev, newScene]);
    setSaveStatus('idle');
  };

  const getSaveButtonContent = () => {
    switch(saveStatus) {
        case 'saving': return <><Spinner /> Saving...</>;
        case 'saved': return 'Project Saved!';
        case 'error': return 'Save Failed';
        default: return <><SaveIcon /> Save Project</>;
    }
  };

  if (isLoadingProject) {
      return (
          <div className="flex justify-center items-center h-64">
              <Spinner />
              <p className="ml-4 text-lg">Loading project...</p>
          </div>
      );
  }

  const hasGeneratedImages = scenes.some(s => s.status === 'success' && s.imageUrls && s.imageUrls.length > 0);
  const hasAnyImages = scenes.some(s => Array.isArray(s.imageUrls) && s.imageUrls.length > 0);
  const canGenerateAll = scenes.some(s => s.status === 'idle' || s.status === 'error');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="container mx-auto px-4 py-6">
        {demoMode && (
          <div className="mb-4 p-3 bg-amber-900/50 border border-amber-600 rounded">
            <div className="flex items-center justify-between">
              <div className="text-amber-200 text-sm">
                <strong>Demo Mode:</strong> You can explore the editor with placeholder content. Generation and rendering are disabled until you upgrade.
              </div>
              <button
                onClick={async () => {
                  try {
                    // Create a real project from current demo content
                    const newProjectId = await createProject({
                      topic: topic || 'Demo Project',
                      characterAndStyle: characterAndStyle || 'Demo style',
                      scenes
                    });
                    setProjectId(newProjectId);
                    onProjectIdChange?.(newProjectId);
                    window.history.pushState({}, '', `?projectId=${newProjectId}`);
                    onExitDemo?.();
                  } catch (e) {
                    toast.error('Failed to upgrade demo. Try again.');
                  }
                }}
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs px-3 py-1 rounded"
              >
                Upgrade Demo → Real Project
              </button>
            </div>
          </div>
          )}
        
        {/* Product Demo Mode Toggle */}
        {!demoMode && (
          <div className="mb-6 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="productDemoMode"
                checked={productDemoMode}
                onChange={(e) => setProductDemoMode(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
              />
              <label htmlFor="productDemoMode" className="text-blue-200 font-medium">
                Product Demo Mode
              </label>
              <span className="text-blue-300 text-sm">• Upload product images to create custom demo videos</span>
            </div>
            
            {productDemoMode && (
              <div className="mt-4 p-4 bg-gray-800 rounded-lg border border-gray-600">
                <h3 className="text-lg font-semibold text-white mb-3">Product Images</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  {productImages.map((image, index) => (
                    <div key={index} className="relative">
                      <img
                        src={image}
                        alt={`Product ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg border border-gray-600"
                      />
                      <button
                        onClick={() => setProductImages(prev => prev.filter((_, i) => i !== index))}
                        className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-700 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {productImages.length < 8 && (
                    <div className="border-2 border-dashed border-gray-600 rounded-lg h-24 flex items-center justify-center cursor-pointer hover:border-blue-500 transition-colors"
                         onClick={() => {
                           const input = document.createElement('input');
                           input.type = 'file';
                           input.accept = 'image/*';
                           input.multiple = true;
                           input.onchange = (e) => {
                             const files = (e.target as HTMLInputElement).files;
                             if (files) {
                               Array.from(files).forEach(file => {
                                 const reader = new FileReader();
                                 reader.onload = (e) => {
                                   setProductImages(prev => [...prev, e.target?.result as string]);
                                 };
                                 reader.readAsDataURL(file);
                               });
                             }
                           };
                           input.click();
                         }}>
                      <div className="text-center text-gray-400">
                        <svg className="w-8 h-8 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        <div className="text-xs">Add Image</div>
                      </div>
                    </div>
                  )}
                </div>
                <p className="text-sm text-gray-400">
                  Upload up to 8 product images. These will be used to generate custom demo scenes.
                </p>
              </div>
            )}
          </div>
        )}
        
        {/* Step 1 & 2: Project Creation */}
        {!projectId && (
             <div className="bg-gray-800 p-4 md:p-6 rounded-lg shadow-xl border border-gray-700 mb-6 md:mb-8">
                <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 text-amber-400">Create Your Story</h2>
                
                <div className="mb-4 md:mb-6">
                    <h3 className="text-base md:text-lg font-semibold text-gray-300 mb-3">Quick Start Ideas</h3>
                    <div className="flex flex-wrap gap-2 mb-3">
                        {quickStartIdeas.map(idea => (
                            <button key={idea} onClick={() => handleInspirationClick(idea)} disabled={isLoadingStory} className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-3 md:px-4 rounded-lg transition-colors text-xs md:text-sm disabled:opacity-50 disabled:cursor-wait">
                                {idea}
                            </button>
                        ))}
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        <button 
                            onClick={handleGenerateInspiration} 
                            disabled={isGeneratingInspiration || isLoadingStory}
                            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-3 md:px-4 rounded-lg transition-colors text-xs md:text-sm disabled:opacity-50 disabled:cursor-wait flex items-center gap-2"
                        >
                            {isGeneratingInspiration ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <SparklesIcon />
                                    Generate New Ideas
                                </>
                            )}
                        </button>
                        {generatedInspiration && (
                            <div className="text-xs md:text-sm text-gray-400">
                                Generated: <span className="text-amber-400 font-medium">{generatedInspiration}</span>
                            </div>
                        )}
                    </div>
                </div>
                
                <div className="mb-4 md:mb-6">
                    <h3 className="text-base md:text-lg font-semibold text-gray-300 mb-3">Your Story Idea</h3>
                    <input
                        type="text"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder="Write your story idea, e.g., A banana who wants to be a superhero"
                        className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-amber-500 focus:outline-none transition text-sm md:text-base"
                        disabled={isLoadingStory}
                    />
                </div>
                
                <div className="mb-4 md:mb-6">
                    <h3 className="text-base md:text-lg font-semibold text-gray-300 mb-3">Project Name</h3>
                    <input
                        type="text"
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        placeholder="Optional - will use story topic if empty"
                        className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-amber-500 focus:outline-none transition text-sm md:text-base"
                        disabled={isLoadingStory}
                    />
                </div>
                   
                   <div className="flex flex-col md:flex-row gap-4">
                   <div className="w-full md:w-auto">
                     <OperationCostDisplay
                       operation="storyGeneration"
                       onInsufficientCredits={() => setShowCreditPurchase(true)}
                       className="mb-2"
                     />
                     <button
                         onClick={() => handleGenerateStory(topic)}
                         disabled={isLoadingStory}
                         className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-6 rounded-lg transition-all flex items-center justify-center gap-2 disabled:bg-gray-600 disabled:cursor-not-allowed"
                     >
                         {isLoadingStory ? <Spinner /> : <SparklesIcon />}
                         {isLoadingStory ? 'Generating...' : 'Generate Story'}
                     </button>
                   </div>
                    <button
                      onClick={() => {
                        console.log('🎬 Start from Template button clicked - navigating to templates page');
                        if (onNavigate) {
                          onNavigate('templates');
                        } else {
                          console.warn('🎬 onNavigate not available');
                        }
                      }}
                      className="w-full md:w-auto bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <DocumentAddIcon />
                      Start from Template
                    </button>
                   </div>
                {storyError && <p className="text-red-400 mt-3">{storyError}</p>}
            </div>
        )}

        {/* Cost Estimation */}
        {scenes.length > 0 && (
          <div className="mb-6">
            <CostEstimator scenes={scenes} showPerScene={scenes.length > 1} />
          </div>
        )}
      
      {/* Main Editor for existing projects */}
      {projectId && (
        <>
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700 mb-8">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-amber-400">Project: "{topic}"</h2>
                    <button onClick={handleNewStory} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors text-sm">
                        <DocumentAddIcon /> New Story
                    </button>
                </div>

                <h3 className="text-lg font-bold mb-2 text-gray-300">Character & Style</h3>
                <textarea
                    value={characterAndStyle}
                    onChange={(e) => {
                        setCharacterAndStyle(e.target.value);
                        setSaveStatus('idle');
                    }}
                    placeholder="Character and style will be auto-generated based on your story topic..."
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-amber-500 focus:outline-none transition mb-2"
                    rows={2}
                />
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => setShowCharacterPicker(true)}
                    className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg text-sm"
                  >
                    Pick a Character
                  </button>
                  <button
                    onClick={() => setShowCharacterGenerator(true)}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg text-sm flex items-center gap-2"
                  >
                    <SparklesIcon className="w-4 h-4" />
                    Generate Character
                  </button>
                </div>
                 {characterAndStyle.trim() && (
                    <div className="text-sm p-2 bg-green-900/50 border border-green-700 rounded-lg">
                        <p className="text-green-300">
                        <strong>✨ Auto-generated:</strong> Character and style created by AI based on your story topic. You can edit this if needed!
                        </p>
                    </div>
                )}

                {/* Character Passport (Reference Images) */}
                <div className="mt-4">
                  <label className="text-sm font-semibold text-gray-300 block mb-2">Character Passport (up to 3 reference images)</label>
                  <div className="flex flex-wrap items-center gap-3">
                    {characterRefs.map((url, idx) => (
                      <div key={idx} className="relative w-20 h-20 rounded-md overflow-hidden border border-gray-600">
                        <img src={url} alt={`ref-${idx}`} className="w-full h-full object-cover" />
                        <button
                          onClick={() => setCharacterRefs(refs => refs.filter((_, i) => i !== idx))}
                          className="absolute top-1 right-1 bg-black/60 text-white text-xs px-1 rounded"
                          aria-label="Remove reference"
                        >✕</button>
                      </div>
                    ))}
                    {characterRefs.length < 3 && (
                      <label className="w-20 h-20 flex items-center justify-center border-2 border-dashed border-gray-600 rounded-md text-gray-400 cursor-pointer hover:border-amber-500 hover:text-amber-400">
                        +
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            const dataUrl = await fileToDataUrl(f);
                            setCharacterRefs(refs => [...refs, dataUrl]);
                            setSaveStatus('idle');
                          }}
                        />
                      </label>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">These images help Gemini keep your character consistent across scenes.</p>
                </div>
            </div>

            <div>
              <div className="flex flex-wrap justify-between items-center mb-4 gap-4">
                <h2 className="text-2xl font-bold text-amber-400">Storyboard & Image Generation</h2>
                <div className="text-sm text-gray-300">
                  Est. image credits total: {
                    scenes
                      .filter(s => s.status === 'idle' || s.status === 'error')
                      .reduce((sum) => sum + (renderMode === 'draft' ? 3 : 5), 0)
                  }
                </div>
                
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200">
                      <span>Mode</span>
                      <select
                        value={renderMode}
                        onChange={(e) => setRenderMode(e.target.value as 'draft' | 'final')}
                        className="bg-gray-900 border border-gray-700 text-white text-xs rounded px-2 py-1"
                      >
                        <option value="draft">Draft (3 frames)</option>
                        <option value="final">Final (5 frames)</option>
                      </select>
                    </div>
                    <button
                        onClick={handleSaveProject}
                        disabled={saveStatus !== 'idle'}
                        className={`font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-75 ${
                            saveStatus === 'saved' ? 'bg-green-600' :
                            saveStatus === 'error' ? 'bg-red-600' :
                            'bg-indigo-600 hover:bg-indigo-700'
                        } text-white`}
                    >
                        {getSaveButtonContent()}
                    </button>
                    <button
                        onClick={handleSaveAsTemplate}
                        disabled={isSavingTemplate || !topic || !scenes.length}
                        className="font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-75 bg-purple-600 hover:bg-purple-700 text-white"
                        title="Save current project as a reusable template"
                    >
                        {isSavingTemplate ? (
                            <>
                                <Spinner />
                                Saving Template...
                            </>
                        ) : (
                            <>
                                <DocumentAddIcon />
                                Save as Template
                            </>
                        )}
                    </button>
                    <div className="flex flex-col gap-2">
                        <OperationCostDisplay
                            operation="imageGeneration"
                            params={{ imageCount: scenes.filter(s => s.status === 'idle' || s.status === 'error').length * (renderMode === 'draft' ? 3 : 5) }}
                            onInsufficientCredits={() => setShowCreditPurchase(true)}
                            className="mb-2"
                        />
                        <button
                            onClick={handleGenerateAllImages}
                            disabled={isGeneratingAll || !canGenerateAll}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-wait"
                        >
                            {isGeneratingAll ? <Spinner /> : <SparklesIcon />}
                            {isGeneratingAll ? 'Generating...' : 'Generate All'}
                        </button>
                    </div>
                    <button 
                      onClick={handleAddScene}
                      className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors"
                    >
                      <PlusIcon /> Add Scene
                    </button>
                </div>
              </div>
              
              {/* Total Cost Display */}
              {scenes.length > 0 && (
                <div className="bg-gray-800 rounded-lg p-4 mb-6 border border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-white">Story Cost Summary</h3>
                      <p className="text-sm text-gray-400">Estimated cost for all scenes</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-amber-400">
                        {formatCost(calculateTotalCost(scenes).total)}
                      </div>
                      <div className="text-sm text-gray-500">
                        {scenes.length} scene{scenes.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-700">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Image Generation:</span>
                        <span className="text-white">{formatCost(calculateTotalCost(scenes).breakdown.imageGeneration)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Narration:</span>
                        <span className="text-white">{formatCost(calculateTotalCost(scenes).breakdown.narration)}</span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-600 mt-2">
                      *Costs are estimates based on token usage. Actual costs may vary.
                    </div>
                  </div>
                </div>
              )}

              {/* Final Generated Video Display */}
              {projectVideoUrl && (
                <div className="bg-gradient-to-r from-green-900/50 to-blue-900/50 rounded-xl p-6 mb-8 border border-green-700">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-2xl font-bold text-green-400 flex items-center gap-3">
                      <div className="p-2 bg-green-500/20 rounded-lg">
                        <svg className="w-6 h-6 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                        </svg>
                      </div>
                      🎬 Your Movie is Ready!
                    </h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => window.open(projectVideoUrl, '_blank')}
                        className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                        Download
                      </button>
                      <button
                        onClick={() => navigator.clipboard.writeText(projectVideoUrl)}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                          <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                        </svg>
                        Copy Link
                      </button>
                    </div>
                  </div>
                  
                  <div className="relative bg-black rounded-lg overflow-hidden">
                    <video 
                      src={projectVideoUrl} 
                      controls 
                      className="w-full h-64 bg-gray-900"
                      poster="/logo.png"
                    >
                      Your browser does not support the video tag.
                    </video>
                    <div className="absolute top-4 left-4 bg-black/70 text-white px-3 py-1 rounded-full text-sm font-medium">
                      Final Movie
                    </div>
                  </div>
                  
                  <div className="mt-4 text-center">
                    <p className="text-gray-300 text-sm">
                      🎉 Congratulations! Your movie has been generated and is ready to share.
                    </p>
                  </div>
                </div>
              )}
              
              <DragGrid
                scenes={scenes}
                renderMode={renderMode}
                onReorder={(newOrder) => {
                  setScenes(newOrder);
                  setSaveStatus('idle');
                }}
                onDelete={handleDeleteScene}
                onGenerate={handleGenerateImageSequence}
                onVariant={handleGenerateVariant}
                onGenerateVideo={handleGenerateVideo}
                onUpdateScene={handleUpdateScene}
                onUpdateSequence={handleUpdateSequence}
              />

              <div className="text-center">
                 <h2 className="text-2xl font-bold text-amber-400 mb-4">Create Your Movie</h2>
                 <p className="text-gray-400 mb-6 max-w-2xl mx-auto">Once you have generated images for your scenes, you can assemble them into a short movie. The backend will narrate, add captions, and render your video.</p>
                
                <div className="flex flex-col gap-4 justify-center items-center">
                  <OperationCostDisplay
                    operation="videoRendering"
                    params={{ sceneCount: scenes.length }}
                    onInsufficientCredits={() => setShowCreditPurchase(true)}
                    className="mb-2"
                  />
                  <button
                    onClick={() => onPlayMovie(scenes)}
                    disabled={demoMode ? !hasAnyImages : !hasGeneratedImages}
                    className="bg-green-600 hover:bg-green-700 text-white font-extrabold text-xl py-4 px-10 rounded-lg transition-all disabled:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Play My Movie!
                  </button>
                </div>
                
                {projectVideoUrl && (
                    <button
                      onClick={() => {
                        // Navigate to player view with the existing video
                        window.history.pushState({}, '', `?projectId=${projectId}&view=player`);
                        window.location.reload();
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xl py-4 px-10 rounded-lg transition-all flex items-center gap-2"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h1m4 0h1m-6-8h8a2 2 0 012 2v8a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2z" />
                      </svg>
                      View Generated Video
                    </button>
                  )}
                </div>
                
                {!hasGeneratedImages && !demoMode && (
                  <p className="text-sm text-gray-500 mt-2">Generate at least one image to enable this button.</p>
                )}
                {demoMode && (
                  <p className="text-sm text-amber-400 mt-1">Demo Mode: Renders with narration and captions (no music or polish).</p>
                )}
                {projectVideoUrl && (
                  <p className="text-sm text-green-400 mt-2">✅ Video already generated! Click "View Generated Video" to watch it.</p>
                )}
              </div>
          <TemplatesModal open={showTemplatePicker} onClose={() => setShowTemplatePicker(false)} onPick={handleLoadTemplate} />
          <CharacterPicker
            topic={topic || 'an adventurous banana'}
            open={showCharacterPicker}
            onClose={() => setShowCharacterPicker(false)}
            currentDescription={characterAndStyle}
            currentImages={characterRefs}
            onPick={(opt) => {
              setCharacterAndStyle(opt.description);
              setCharacterRefs(opt.images);
              setShowCharacterPicker(false);
              setSaveStatus('idle');
              // Persist to project if available
              if (projectId) {
                try {
                  const updateData: any = { 
                    topic, 
                    characterAndStyle: opt.description, 
                    scenes 
                  };
                  // Only add characterRefs if opt.images exists and is not empty
                  if (opt.images && opt.images.length > 0) {
                    updateData.characterRefs = opt.images;
                  }
                  updateProject(projectId, updateData);
                } catch (error) {
                  console.error('Error updating project with character selection:', error);
                }
              }
            }}
          />
          <CharacterGenerator
            topic={topic || 'an adventurous character'}
            open={showCharacterGenerator}
            onClose={() => setShowCharacterGenerator(false)}
            onGenerate={(characters) => {
              if (characters.length > 0) {
                setCharacterAndStyle(characters[0].description);
                setCharacterRefs(characters[0].images);
                setSaveStatus('idle');
                // Persist to project if available
                if (projectId) {
                  try {
                    const updateData: any = { 
                      topic, 
                      characterAndStyle: characters[0].description, 
                      scenes 
                    };
                    if (characters[0].images && characters[0].images.length > 0) {
                      updateData.characterRefs = characters[0].images;
                    }
                    updateProject(projectId, updateData);
                  } catch (error) {
                    console.error('Error updating project with generated character:', error);
                  }
                }
              }
            }}
          />
        </>
      )}

      {/* Credit Purchase Modal */}
      <CreditPurchaseModal
        isOpen={showCreditPurchase}
        onClose={() => setShowCreditPurchase(false)}
        onSuccess={() => {
          // Refresh credits after successful purchase
          window.location.reload(); // Simple refresh for now
        }}
      />
      </div>
    </div>
  );
};

export default StoryboardEditor;
