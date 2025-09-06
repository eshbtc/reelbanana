// Fix: Implement the StoryboardEditor component. This file was previously invalid.
import React, { useState, useCallback, useEffect } from 'react';
import { Scene } from '../types';
import { generateStory, generateCharacterAndStyle, generateImageSequence } from '../services/geminiService';
import { createProject, getProject, updateProject } from '../services/firebaseService';
import SceneCard from './SceneCard';
import Spinner from './Spinner';
import { PlusIcon, SparklesIcon, SaveIcon, DocumentAddIcon } from './Icon';

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
  const [scenes, setScenes] = useState<Scene[]>([]);
  
  const [isLoadingStory, setIsLoadingStory] = useState(false);
  const [isLoadingProject, setIsLoadingProject] = useState(true); // Start true for initial load check
  const [storyError, setStoryError] = useState<string | null>(null);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

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
        setScenes([]);
        setStoryError(null);
        window.history.pushState({}, '', window.location.pathname);
    }
  };


  const handleInspirationClick = (inspirationTopic: string) => {
      handleGenerateStory(inspirationTopic);
  };

  const handleGenerateImageSequence = useCallback(async (id: string, prompt: string) => {
    if (!characterAndStyle.trim()) {
        alert("Please describe your character and style before generating images.");
        return;
    }
    setScenes(prevScenes =>
      prevScenes.map(s => s.id === id ? { ...s, status: 'generating', error: undefined } : s)
    );
    try {
      const imageUrls = await generateImageSequence(prompt, characterAndStyle);
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
  }, [characterAndStyle]);
  
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


  const handleUpdateScene = useCallback((id: string, updates: Partial<Pick<Scene, 'prompt' | 'narration' | 'camera' | 'transition' | 'duration'>>) => {
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
            </div>

            <div>
              <div className="flex flex-wrap justify-between items-center mb-4 gap-4">
                <h2 className="text-2xl font-bold text-amber-400">Storyboard & Image Generation</h2>
                <div className="flex items-center gap-2">
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
        </>
      )}
    </div>
  );
};

export default StoryboardEditor;