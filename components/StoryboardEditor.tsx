// Fix: Implement the StoryboardEditor component. This file was previously invalid.
import React, { useState, useCallback, useEffect } from 'react';
import { Scene, StylePreset } from '../types';
import { generateStory, generateCharacterAndStyle, generateImageSequence } from '../services/geminiService';
import { createProject, getProject, updateProject } from '../services/firebaseService';
import SceneCard from './SceneCard';
import Spinner from './Spinner';
import { PlusIcon, SparklesIcon, SaveIcon, DocumentAddIcon } from './Icon';
import { TEMPLATES } from '../lib/templates';
import CharacterPicker from './CharacterPicker';
import { calculateTotalCost, formatCost } from '../utils/costCalculator';
import { useUserCredits } from '../hooks/useUserCredits';
import { getCurrentUser, hasUserApiKey } from '../services/authService';
import { getAI, getGenerativeModel } from 'firebase/ai';
import { firebaseApp } from '../lib/firebase';
import { authFetch } from '../lib/authFetch';
import { API_ENDPOINTS } from '../config/apiConfig';

// Initialize Firebase AI
const ai = getAI(firebaseApp);

interface StoryboardEditorProps {
  onPlayMovie: (scenes: Scene[]) => void;
  onProjectIdChange?: (id: string | null) => void;
  demoMode?: boolean;
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

const StoryboardEditor: React.FC<StoryboardEditorProps> = ({ onPlayMovie, onProjectIdChange, demoMode = false }) => {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [topic, setTopic] = useState('');
  const [characterAndStyle, setCharacterAndStyle] = useState('');
  const [characterRefs, setCharacterRefs] = useState<string[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  
  const [isLoadingStory, setIsLoadingStory] = useState(false);
  const [isLoadingProject, setIsLoadingProject] = useState(true); // Start true for initial load check
  const [storyError, setStoryError] = useState<string | null>(null);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [showTemplates, setShowTemplates] = useState(false);
  const [showCharacterPicker, setShowCharacterPicker] = useState(false);
  const [renderMode, setRenderMode] = useState<'draft' | 'final'>('draft');
  const [forceUseApiKey, setForceUseApiKey] = useState(false);
  const [userHasApiKey, setUserHasApiKey] = useState(false);
  const [isGeneratingInspiration, setIsGeneratingInspiration] = useState(false);
  const [generatedInspiration, setGeneratedInspiration] = useState<string>('');
  
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
  const { refreshCredits } = useUserCredits();

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
                    setTopic(projectData.topic);
                    setCharacterAndStyle(projectData.characterAndStyle);
                    setScenes(projectData.scenes);
                } else {
                    alert("Project not found. You can start a new one.");
                    window.history.replaceState({}, '', window.location.pathname);
                }
            } catch (error) {
                setStoryError(error instanceof Error ? error.message : "Failed to load project.");
            }
        }
        setIsLoadingProject(false);
    };
    loadProjectFromUrl();
  }, []);

  // Check if user has API key for BYOK option
  useEffect(() => {
    const checkUserApiKey = async () => {
      const currentUser = getCurrentUser();
      if (!currentUser) {
        setUserHasApiKey(false);
        return;
      }

      try {
        const hasGoogleKey = await hasUserApiKey(currentUser.uid, 'google');
        const hasFalKey = await hasUserApiKey(currentUser.uid, 'fal');
        console.log('🔍 BYOK Check: Google key =', hasGoogleKey, ', FAL key =', hasFalKey);
        const hasAnyKey = hasGoogleKey || hasFalKey;
        setUserHasApiKey(hasAnyKey);
        console.log('🔍 BYOK: userHasApiKey =', hasAnyKey);
      } catch (error) {
        console.error('Error checking API key:', error);
        setUserHasApiKey(false);
      }
    };

    checkUserApiKey();
  }, []);

  const handleGenerateStory = useCallback(async (storyTopic: string) => {
    if (!storyTopic.trim()) {
      setStoryError("Please enter or select a topic for your story.");
      return;
    }
    setIsLoadingStory(true);
    setStoryError(null);
    setScenes([]);

    try {
      // Generate both story and character/style in parallel
      const [storyScenes, characterStyle] = await Promise.all([
        generateStory(storyTopic, forceUseApiKey),
        generateCharacterAndStyle(storyTopic, forceUseApiKey)
      ]);
      
      if (storyScenes.length === 0) {
        throw new Error("The AI couldn't generate a story for this topic. Please try a different one.");
      }
      
      const initialScenes: Scene[] = storyScenes.map((s, index) => ({
        id: `${Date.now()}-${index}`,
        prompt: s.prompt,
        narration: s.narration,
        status: 'idle',
      }));

      // Create a new project in Firestore
      const newProjectId = await createProject({
          topic: storyTopic,
          characterAndStyle: characterStyle, // Auto-generated
          scenes: initialScenes
      });
      
      setProjectId(newProjectId);
      try { onProjectIdChange?.(newProjectId); } catch {}
      setTopic(storyTopic);
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
  }, []);
  
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

  const handleNewStory = () => {
    if (window.confirm("Are you sure you want to start a new story? Any unsaved changes will be lost.")) {
        setProjectId(null);
        try { onProjectIdChange?.(null); } catch {}
        setTopic('');
        setCharacterAndStyle('');
        setCharacterRefs([]);
        setScenes([]);
        setStoryError(null);
        window.history.pushState({}, '', window.location.pathname);
    }
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

      // Use Firebase AI directly for inspiration generation
      const model = getGenerativeModel(ai, { 
        model: "gemini-2.5-flash",
        generationConfig: {
          maxOutputTokens: 100,
          temperature: 0.9, // Higher creativity
        }
      });
      
      const result = await model.generateContent(inspirationPrompt);
      const inspiration = result.response.text().trim();
      
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
    const tpl = TEMPLATES.find(t => t.id === templateId);
    console.log('📝 Found template:', tpl?.title || 'NOT FOUND');
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
      setShowTemplates(false);
      window.history.pushState({}, '', `?projectId=${newProjectId}`);
      console.log('📝 Template loaded successfully!');
    } catch (e) {
      console.error('📝 Failed to load template:', e);
      alert('Failed to load template. Please try again.');
    }
  }, []);

  const handleGenerateImageSequence = useCallback(async (id: string, prompt: string) => {
    if (!characterAndStyle.trim()) {
        alert("Please describe your character and style before generating images.");
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
      const imageUrls = await generateImageSequence(prompt, styleInstruction, {
        characterRefs,
        backgroundImage: bg,
        frames: renderMode === 'draft' ? 3 : 5,
        projectId: projectId || undefined,
        forceUseApiKey
      });
      setScenes(prevScenes =>
        prevScenes.map(s => s.id === id ? { ...s, status: 'success', imageUrls } : s)
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
  }, [characterAndStyle, scenes, characterRefs, renderMode]);

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
      const imageUrls = await generateImageSequence(`${prompt} (alternative angle variation)`, styleInstruction, {
        characterRefs,
        backgroundImage: bg,
        frames: renderMode === 'draft' ? 3 : 5,
        projectId: projectId || undefined,
        forceUseApiKey
      });
      setScenes(prev => prev.map(s => s.id === id ? { ...s, status: 'success', variantImageUrls: imageUrls } : s));
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Variant generation failed.';
      setScenes(prev => prev.map(s => s.id === id ? { ...s, status: 'error', error: errorMessage } : s));
    }
  }, [scenes, characterAndStyle, characterRefs, renderMode]);


  const handleUpdateScene = useCallback((id: string, updates: Partial<Pick<Scene, 'prompt' | 'narration' | 'camera' | 'transition' | 'duration' | 'backgroundImage' | 'stylePreset'>>) => {
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
  const canGenerateAll = scenes.some(s => s.status === 'idle' || s.status === 'error');

  return (
    <div>
        {/* Step 1 & 2: Project Creation */}
        {!projectId && (
             <div className="bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700 mb-8">
                <h2 className="text-2xl font-bold mb-4 text-amber-400">Create Your Story</h2>
                <div className="mb-4">
                    <h3 className="text-lg font-semibold text-gray-300 mb-2">Quick Start Ideas</h3>
                    <div className="flex flex-wrap gap-2 mb-3">
                        {quickStartIdeas.map(idea => (
                            <button key={idea} onClick={() => handleInspirationClick(idea)} disabled={isLoadingStory} className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors text-sm disabled:opacity-50 disabled:cursor-wait">
                                {idea}
                            </button>
                        ))}
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={handleGenerateInspiration} 
                            disabled={isGeneratingInspiration || isLoadingStory}
                            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors text-sm disabled:opacity-50 disabled:cursor-wait flex items-center gap-2"
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
                            <div className="text-sm text-gray-400">
                                Generated: <span className="text-amber-400 font-medium">{generatedInspiration}</span>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex flex-col gap-4">
                   <input
                       type="text"
                       value={topic}
                       onChange={(e) => setTopic(e.target.value)}
                       placeholder="Or write your own story idea, e.g., A banana who wants to be a superhero"
                       className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-amber-500 focus:outline-none transition"
                       disabled={isLoadingStory}
                   />
                   
                   <div className="flex items-center gap-3">
                     <input
                       type="checkbox"
                       id="forceUseApiKey"
                       checked={forceUseApiKey}
                       onChange={(e) => setForceUseApiKey(e.target.checked)}
                       disabled={!userHasApiKey}
                       className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2 disabled:opacity-50"
                     />
                     <label htmlFor="forceUseApiKey" className={`text-sm ${userHasApiKey ? 'text-gray-300' : 'text-gray-500'}`}>
                       🔑 Use My API Key (Skip free credits)
                       {!userHasApiKey && <span className="text-xs block text-gray-600">→ Add an API key in Dashboard to enable</span>}
                     </label>
                   </div>
                   
                   <div className="flex flex-col md:flex-row gap-4">
                   <button
                       onClick={() => handleGenerateStory(topic)}
                       disabled={isLoadingStory}
                       className="w-full md:w-auto bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-6 rounded-lg transition-all flex items-center justify-center gap-2 disabled:bg-gray-600 disabled:cursor-not-allowed"
                   >
                       {isLoadingStory ? <Spinner /> : <SparklesIcon />}
                       {isLoadingStory ? 'Generating...' : 'Generate Story'}
                   </button>
                    <button
                      onClick={() => {
                        console.log('📝 Start from Template clicked');
                        console.log('📝 Current showTemplates state:', showTemplates);
                        console.log('📝 Available templates:', TEMPLATES.length);
                        setShowTemplates(true);
                        console.log('📝 Setting showTemplates to true');
                      }}
                      className="w-full md:w-auto bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                    >
                      Start from Template
                    </button>
                   </div>
                </div>
                {storyError && <p className="text-red-400 mt-3">{storyError}</p>}
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
                
                <div className="flex items-center gap-3 mb-4">
                  <input
                    type="checkbox"
                    id="forceUseApiKeyImagesGenerate"
                    checked={forceUseApiKey}
                    onChange={(e) => setForceUseApiKey(e.target.checked)}
                    disabled={!userHasApiKey}
                    className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2 disabled:opacity-50"
                  />
                  <label htmlFor="forceUseApiKeyImagesGenerate" className={`text-sm ${userHasApiKey ? 'text-gray-300' : 'text-gray-500'}`}>
                    🔑 Use My API Key for image generation (Skip free credits)
                    {!userHasApiKey && <span className="text-xs block text-gray-600">→ Add an API key in Dashboard to enable</span>}
                  </label>
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
                        onClick={handleGenerateAllImages}
                        disabled={isGeneratingAll || !canGenerateAll}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-wait"
                    >
                        {isGeneratingAll ? <Spinner /> : <SparklesIcon />}
                        {isGeneratingAll ? 'Generating...' : 'Generate All'}
                    </button>
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
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {scenes.map((scene, index) => (
                  <SceneCard
                    key={scene.id}
                    scene={scene}
                    index={index}
                    onDelete={handleDeleteScene}
                    onGenerateImage={handleGenerateImageSequence}
                    onGenerateVariant={handleGenerateVariant}
                    onUpdateScene={handleUpdateScene}
                    onUpdateSequence={handleUpdateSequence}
                    framesPerScene={renderMode === 'draft' ? 3 : 5}
                  />
                ))}
              </div>

              <div className="text-center">
                 <h2 className="text-2xl font-bold text-amber-400 mb-4">Create Your Movie</h2>
                 <p className="text-gray-400 mb-6 max-w-2xl mx-auto">Once you have generated images for your scenes, you can assemble them into a short movie. The backend will narrate, add captions, and render your video.</p>
                <button
                  onClick={() => onPlayMovie(scenes)}
                  disabled={!hasGeneratedImages}
                  className="bg-green-600 hover:bg-green-700 text-white font-extrabold text-xl py-4 px-10 rounded-lg transition-all disabled:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Play My Movie!
                </button>
                {!hasGeneratedImages && <p className="text-sm text-gray-500 mt-2">Generate at least one image to enable this button.</p>}
              </div>
            </div>
            <TemplatesModal open={showTemplates} onClose={() => setShowTemplates(false)} onPick={handleLoadTemplate} />
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
        </>
      )}
    </div>
  );
};

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


export default StoryboardEditor;
