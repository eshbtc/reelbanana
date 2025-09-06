// Fix: Implement the StoryboardEditor component. This file was previously invalid.
import React, { useState, useCallback, useEffect } from 'react';
import { Scene, StylePreset } from '../types';
import { generateStory, generateCharacterAndStyle, generateImageSequence } from '../services/geminiService';
import { createProject, getProject, updateProject } from '../services/firebaseService';
import SceneCard from './SceneCard';
import Spinner from './Spinner';
import { PlusIcon, SparklesIcon, SaveIcon, DocumentAddIcon } from './Icon';
import { TEMPLATES } from '../lib/templates';

interface StoryboardEditorProps {
  onPlayMovie: (scenes: Scene[]) => void;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const inspirationTopics = [
    "The Lost Astronaut",
    "Mystery in the Magical Forest",
    "Neon Noir Detective",
    "The Secret Recipe",
];

const StoryboardEditor: React.FC<StoryboardEditorProps> = ({ onPlayMovie }) => {
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
  const [renderMode, setRenderMode] = useState<'draft' | 'final'>('draft');

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
        generateStory(storyTopic),
        generateCharacterAndStyle(storyTopic)
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
      setTopic(storyTopic);
      setCharacterAndStyle(characterStyle); // Auto-generated
      setScenes(initialScenes);
      setSaveStatus('saved');
      
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

  const handleLoadTemplate = useCallback(async (templateId: string) => {
    const tpl = TEMPLATES.find(t => t.id === templateId);
    if (!tpl) return;
    try {
      const initialScenes: Scene[] = tpl.scenes.map((s, index) => ({
        id: `${Date.now()}-${index}`,
        prompt: s.prompt,
        narration: s.narration,
        status: 'idle',
      }));
      const newProjectId = await createProject({
        topic: tpl.topic,
        characterAndStyle: tpl.characterAndStyle,
        scenes: initialScenes,
      });
      setProjectId(newProjectId);
      setTopic(tpl.topic);
      setCharacterAndStyle(tpl.characterAndStyle);
      setCharacterRefs(tpl.characterRefs || []);
      setScenes(initialScenes);
      setSaveStatus('saved');
      setShowTemplates(false);
      window.history.pushState({}, '', `?projectId=${newProjectId}`);
    } catch (e) {
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
      });
      setScenes(prevScenes =>
        prevScenes.map(s => s.id === id ? { ...s, status: 'success', imageUrls } : s)
      );
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
                    <h3 className="text-lg font-semibold text-gray-300 mb-2">Need Inspiration?</h3>
                    <div className="flex flex-wrap gap-2">
                        {inspirationTopics.map(idea => (
                            <button key={idea} onClick={() => handleInspirationClick(idea)} disabled={isLoadingStory} className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors text-sm disabled:opacity-50 disabled:cursor-wait">
                                {idea}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex flex-col md:flex-row gap-4 items-start">
                   <input
                       type="text"
                       value={topic}
                       onChange={(e) => setTopic(e.target.value)}
                       placeholder="Or write your own story topic, e.g., A banana who wants to be a superhero"
                       className="flex-grow bg-gray-900 border border-gray-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-amber-500 focus:outline-none transition"
                       disabled={isLoadingStory}
                   />
                   <button
                       onClick={() => handleGenerateStory(topic)}
                       disabled={isLoadingStory}
                       className="w-full md:w-auto bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-6 rounded-lg transition-all flex items-center justify-center gap-2 disabled:bg-gray-600 disabled:cursor-not-allowed"
                   >
                       {isLoadingStory ? <Spinner /> : <SparklesIcon />}
                       {isLoadingStory ? 'Generating...' : 'Generate Story'}
                   </button>
                    <button
                      onClick={() => setShowTemplates(true)}
                      className="w-full md:w-auto bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                    >
                      Start from Template
                    </button>
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
        </>
      )}
    </div>
  );
};

// Templates Modal (inline for simplicity)
const TemplatesModal: React.FC<{ open: boolean; onClose: () => void; onPick: (id: string) => void }> = ({ open, onClose, onPick }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-lg max-w-3xl w-full overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h3 className="text-white font-bold text-lg">Start from Template</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
          {TEMPLATES.map(t => (
            <button key={t.id} onClick={() => onPick(t.id)} className="bg-gray-800 hover:bg-gray-700 text-left p-4 rounded-lg border border-gray-700 transition-colors">
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
