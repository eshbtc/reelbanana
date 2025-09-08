// Fix: Implement the SceneCard component. This file was previously invalid.
import React, { useState, useEffect } from 'react';
import { Scene, CameraMovement, TransitionType, StylePreset } from '../types';
import { TrashIcon, SparklesIcon, EditIcon } from './Icon';
import Spinner from './Spinner';
import EditSequenceModal from './EditSequenceModal';
import CompareModal from './CompareModal';
import { calculateSceneCost, formatCost, getCostTier } from '../utils/costCalculator';
import { getImageCreditPriceUSD, formatUSD } from '../utils/pricing';
import { getVoiceOptions, getVideoModelOptions, getDefaultVoice, getDefaultVideoModel, SCENE_DIRECTION_OPTIONS, getDefaultSceneDirection } from '../lib/voiceAndModelOptions';
import { LOCATION_OPTIONS, PROP_OPTIONS, COSTUME_OPTIONS, getLocationById, getPropById, getCostumeById } from '../lib/sceneDetailsOptions';

interface SceneCardProps {
  scene: Scene;
  index: number;
  onDelete: (id: string) => void;
  onGenerateImage: (id: string, prompt: string) => void;
  onGenerateVariant: (id: string, prompt: string) => void;
  onGenerateVideo?: (id: string) => void;
  onUpdateScene: (id: string, updates: Partial<Pick<Scene, 'prompt' | 'narration' | 'camera' | 'transition' | 'duration' | 'backgroundImage' | 'stylePreset' | 'variantImageUrls' | 'voiceId' | 'voiceName' | 'videoModel' | 'sceneDirection' | 'location' | 'props' | 'costumes' | 'videoUrl' | 'videoStatus'>>) => void;
  onUpdateSequence: (id: string, newImageUrls: string[]) => void;
  framesPerScene?: number;
}

const SceneCard: React.FC<SceneCardProps> = ({ scene, index, onDelete, onGenerateImage, onGenerateVariant, onGenerateVideo, onUpdateScene, onUpdateSequence, framesPerScene = 5 }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState(scene.prompt);
  const [editedNarration, setEditedNarration] = useState(scene.narration);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  
  // Voice and model selection
  const [selectedVoice, setSelectedVoice] = useState(scene.voiceId || '21m00Tcm4TlvDq8ikWAM');
  const [selectedVideoModel, setSelectedVideoModel] = useState(scene.videoModel || 'fal-ai/veo3-fast/image-to-video');
  const [selectedSceneDirection, setSelectedSceneDirection] = useState(scene.sceneDirection || 'cinematic');
  
  // Options state
  const [voiceOptions, setVoiceOptions] = useState<any[]>([]);
  const [modelOptions, setModelOptions] = useState<any[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  
  // Scene details state
  const [selectedLocation, setSelectedLocation] = useState(scene.location || '');
  const [selectedProps, setSelectedProps] = useState<string[]>(scene.props || []);
  const [selectedCostumes, setSelectedCostumes] = useState<string[]>(scene.costumes || []);

  // Calculate scene cost
  const frames = scene.imageUrls?.length || framesPerScene;
  const sceneCost = calculateSceneCost(scene, frames);
  const creditPrice = getImageCreditPriceUSD();
  const estUsdFromCredits = frames * creditPrice;
  const costTier = getCostTier(estUsdFromCredits);

  useEffect(() => {
    if (scene.status === 'success' && scene.imageUrls && scene.imageUrls.length > 1) {
      const intervalId = setInterval(() => {
        setCurrentImageIndex(prevIndex => (prevIndex + 1) % scene.imageUrls!.length);
      }, 800); // Change image every 800ms
      return () => clearInterval(intervalId);
    }
  }, [scene.status, scene.imageUrls]);

  // Load voice and model options
  useEffect(() => {
    const loadOptions = async () => {
      try {
        setIsLoadingOptions(true);
        const [voices, models] = await Promise.all([
          getVoiceOptions(),
          getVideoModelOptions()
        ]);
        setVoiceOptions(voices);
        setModelOptions(models);
      } catch (error) {
        console.error('Failed to load options:', error);
      } finally {
        setIsLoadingOptions(false);
      }
    };
    loadOptions();
  }, []);

  const handleSave = () => {
    onUpdateScene(scene.id, { prompt: editedPrompt, narration: editedNarration });
    setIsEditing(false);
  };
  
  const handleCancel = () => {
    setEditedPrompt(scene.prompt);
    setEditedNarration(scene.narration);
    setIsEditing(false);
  };

  const handleVoiceChange = (voiceId: string) => {
    setSelectedVoice(voiceId);
    const voice = voiceOptions.find(v => v.id === voiceId);
    onUpdateScene(scene.id, { 
      voiceId: voiceId, 
      voiceName: voice?.name || 'Unknown Voice' 
    });
  };

  const handleVideoModelChange = (modelId: string) => {
    setSelectedVideoModel(modelId);
    onUpdateScene(scene.id, { videoModel: modelId });
  };

  const handleSceneDirectionChange = (directionId: string) => {
    setSelectedSceneDirection(directionId);
    onUpdateScene(scene.id, { sceneDirection: directionId });
  };

  const handleLocationChange = (locationId: string) => {
    setSelectedLocation(locationId);
    onUpdateScene(scene.id, { location: locationId });
  };

  const handlePropToggle = (propId: string) => {
    const newProps = selectedProps.includes(propId)
      ? selectedProps.filter(id => id !== propId)
      : [...selectedProps, propId];
    setSelectedProps(newProps);
    onUpdateScene(scene.id, { props: newProps });
  };

  const handleCostumeToggle = (costumeId: string) => {
    const newCostumes = selectedCostumes.includes(costumeId)
      ? selectedCostumes.filter(id => id !== costumeId)
      : [...selectedCostumes, costumeId];
    setSelectedCostumes(newCostumes);
    onUpdateScene(scene.id, { costumes: newCostumes });
  };

  const handleEditComplete = (newImageUrls: string[]) => {
      onUpdateSequence(scene.id, newImageUrls);
  };

  const renderImageContent = () => {
    switch (scene.status) {
      case 'generating':
        return (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900/50">
            <Spinner />
            <p className="text-sm mt-2 text-gray-300">Generating Sequence...</p>
          </div>
        );
      case 'success':
        if (!scene.imageUrls || scene.imageUrls.length === 0) return null;
        return (
            <div className="relative w-full h-full">
              {scene.cached && (
                <div className="absolute top-2 left-2 z-10 bg-amber-500/90 text-black text-[10px] font-bold px-2 py-0.5 rounded">
                  Cached
                </div>
              )}
              <img 
                  src={scene.imageUrls[currentImageIndex]} 
                  alt={`${scene.prompt} - frame ${currentImageIndex + 1}`} 
                  className="w-full h-full object-cover transition-opacity duration-300" 
              />
            </div>
        );
      case 'error':
        return (
          <div className="w-full h-full flex flex-col items-center justify-center bg-red-900/20 text-center p-2">
            <p className="text-red-400 text-sm font-semibold">Generation Failed</p>
            <p className="text-red-500 text-xs mt-1">{scene.error}</p>
            <button
                onClick={() => onGenerateImage(scene.id, scene.prompt)}
                className="mt-3 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold py-1 px-3 rounded-md transition-colors flex items-center gap-1"
            >
                <SparklesIcon className="w-3 h-3"/>
                Retry
            </button>
          </div>
        );
      case 'idle':
      default:
        return (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900/50 p-4 text-center">
             <h3 className="font-bold text-gray-300">Ready to Generate</h3>
             <p className="text-xs text-gray-400 mt-1 mb-3">Click the button below to create an animated sequence for this scene.</p>
            <button
              onClick={() => onGenerateImage(scene.id, scene.prompt)}
              className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
            >
              <SparklesIcon />
              Generate Sequence
            </button>
            <div className="mt-2 text-[10px] text-gray-400">Est. image credits: {framesPerScene}</div>
            {scene.variantImageUrls && scene.variantImageUrls.length > 0 && (
              <button
                onClick={() => setIsCompareOpen(true)}
                className="mt-2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-1 px-3 rounded-md text-xs"
              >
                Compare
              </button>
            )}
            {scene.status === 'success' && scene.imageUrls && scene.imageUrls.length > 0 && !scene.videoUrl && (
              <button
                onClick={() => onGenerateVideo?.(scene.id)}
                className="mt-2 bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-3 rounded-md text-xs flex items-center gap-1"
              >
                🎥 Generate Video
              </button>
            )}
          </div>
        );
    }
  };

  return (
    <>
      <div className="bg-gray-800 rounded-lg overflow-hidden shadow-lg border border-gray-700 flex flex-col">
        <div className="relative h-48 bg-gray-700">
          {renderImageContent()}
          {/* On-screen badges */}
          {scene.stylePreset && scene.stylePreset !== 'none' && (
            <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded">
              Style: {scene.stylePreset.replace('-', ' ')}
            </div>
          )}
          {scene.backgroundImage && (
            <div className="absolute top-2 left-24 bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded">
              Blend: ON
            </div>
          )}
          <div className="absolute top-2 left-2 bg-black/60 text-white text-sm font-bold px-3 py-1 rounded-full">
            Scene {index + 1}
          </div>
          {/* Cost Badge (credits-based) */}
          <div className={`absolute bottom-2 right-2 bg-black/80 text-white text-xs font-bold px-2 py-1 rounded ${costTier.color}`}>
            {formatUSD(estUsdFromCredits)}
          </div>
        </div>
        <div className="p-4 flex-grow flex flex-col">
            {isEditing ? (
                <div className="flex-grow">
                    <label className="text-xs font-bold text-gray-400">Narration</label>
                    <textarea 
                      value={editedNarration}
                      onChange={(e) => setEditedNarration(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-600 rounded-md p-2 text-sm text-gray-200 resize-none focus:ring-amber-500 focus:border-amber-500 mb-2"
                      rows={2}
                    />
                    <label className="text-xs font-bold text-gray-400">Image Prompt</label>
                    <textarea 
                      value={editedPrompt}
                      onChange={(e) => setEditedPrompt(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-600 rounded-md p-2 text-sm text-gray-200 resize-none focus:ring-amber-500 focus:border-amber-500"
                      rows={4}
                    />
                </div>
            ) : (
              <div className="flex-grow">
                <p className="text-gray-300 text-sm mb-2"><strong className="text-gray-400 font-semibold">Narration:</strong> {scene.narration}</p>
                <p className="text-gray-400 text-xs mb-3"><strong className="font-semibold">Prompt:</strong> {scene.prompt}</p>
                
                {/* Cost Breakdown */}
                <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-400">Estimated Cost</span>
                    <span className={`text-sm font-bold ${costTier.color}`}>
                      {formatCost(sceneCost.total)}
                    </span>
                  </div>
                  <div className="space-y-1 text-xs text-gray-500">
                    <div className="flex justify-between">
                      <span>Image Generation (5 frames):</span>
                      <span>{formatCost(sceneCost.imageGeneration)}</span>
                    </div>
                    {scene.narration && (
                      <div className="flex justify-between">
                        <span>Narration:</span>
                        <span>{formatCost(sceneCost.narration)}</span>
                      </div>
                    )}
                    <div className="text-[10px] text-gray-600 mt-2">
                      *Costs are estimates based on token usage
                    </div>
                  </div>
                </div>
              </div>
            )}

          {/* Video Generation Section */}
          {scene.videoUrl && (
            <div className="mt-4 p-3 bg-blue-900/30 rounded-lg border border-blue-700">
              <h4 className="text-xs font-bold text-blue-400 mb-3 flex items-center gap-2">
                🎥 Generated Video
              </h4>
              <div className="relative">
                <video 
                  src={scene.videoUrl} 
                  controls 
                  className="w-full h-32 bg-gray-900 rounded border border-gray-600"
                  preload="metadata"
                >
                  Your browser does not support the video tag.
                </video>
                {scene.videoStatus === 'generating' && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded">
                    <div className="text-center">
                      <Spinner />
                      <p className="text-xs text-white mt-2">Generating Video...</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Director Controls */}
          {scene.status === 'success' && (
            <div className="mt-4 p-3 bg-gray-900/50 rounded-lg border border-gray-600">
              <h4 className="text-xs font-bold text-amber-400 mb-3 flex items-center gap-2">
                🎬 Director Controls
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-400 block mb-1">Camera Movement</label>
                  <select
                    value={scene.camera || 'static'}
                    onChange={(e) => onUpdateScene(scene.id, { camera: e.target.value as CameraMovement })}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:ring-amber-500 focus:border-amber-500"
                  >
                    <option value="static">Static</option>
                    <option value="zoom-in">Zoom In</option>
                    <option value="zoom-out">Zoom Out</option>
                    <option value="pan-left">Pan Left</option>
                    <option value="pan-right">Pan Right</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-400 block mb-1">Transition</label>
                  <select
                    value={scene.transition || 'fade'}
                    onChange={(e) => onUpdateScene(scene.id, { transition: e.target.value as TransitionType })}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:ring-amber-500 focus:border-amber-500"
                  >
                    <option value="fade">Fade</option>
                    <option value="wipeleft">Wipe Left</option>
                    <option value="wiperight">Wipe Right</option>
                    <option value="circleopen">Circle Open</option>
                    <option value="dissolve">Dissolve</option>
                    <option value="none">None</option>
                  </select>
                </div>
              </div>
              <div className="mt-3">
                <label className="text-xs font-semibold text-gray-400 block mb-1">Style Preset</label>
                <select
                  value={scene.stylePreset || 'none'}
                  onChange={(e) => onUpdateScene(scene.id, { stylePreset: e.target.value as StylePreset })}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:ring-amber-500 focus:border-amber-500"
                >
                  <option value="none">None</option>
                  <option value="ghibli">Ghibli watercolor</option>
                  <option value="wes-anderson">Wes Anderson symmetry</option>
                  <option value="film-noir">Film noir</option>
                  <option value="pixel-art">Pixel art</option>
                  <option value="claymation">Claymation</option>
                </select>
              </div>
              <div className="mt-3">
                <label className="text-xs font-semibold text-gray-400 block mb-1">Duration (seconds)</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  step="0.5"
                  value={scene.duration || 3}
                  onChange={(e) => onUpdateScene(scene.id, { duration: parseFloat(e.target.value) })}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:ring-amber-500 focus:border-amber-500"
                />
              </div>

              {/* Voice, Model & Direction Selection */}
              <div className="mt-4 pt-3 border-t border-gray-700">
                <h5 className="text-xs font-bold text-purple-400 mb-3 flex items-center gap-2">
                  🎤 Voice, Model & Direction Settings
                </h5>
                
                {isLoadingOptions ? (
                  <div className="flex items-center justify-center py-4">
                    <Spinner />
                    <span className="ml-2 text-xs text-gray-400">Loading options...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-400 block mb-1">Voice</label>
                      <select
                        value={selectedVoice}
                        onChange={(e) => handleVoiceChange(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:ring-purple-500 focus:border-purple-500"
                      >
                        {voiceOptions.map((voice) => (
                          <option key={voice.id} value={voice.id}>
                            {voice.name} - {voice.description}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="text-xs font-semibold text-gray-400 block mb-1">Video Model</label>
                      <select
                        value={selectedVideoModel}
                        onChange={(e) => handleVideoModelChange(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:ring-purple-500 focus:border-purple-500"
                      >
                        {modelOptions.map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.name} - {model.description} ({model.cost} cost)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-400 block mb-1">Scene Direction</label>
                      <select
                        value={selectedSceneDirection}
                        onChange={(e) => handleSceneDirectionChange(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:ring-purple-500 focus:border-purple-500"
                      >
                        {SCENE_DIRECTION_OPTIONS.map((direction) => (
                          <option key={direction.id} value={direction.id}>
                            {direction.name} - {direction.description}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Scene Details */}
              <div className="mt-4 pt-3 border-t border-gray-700">
                <h5 className="text-xs font-bold text-blue-400 mb-3 flex items-center gap-2">
                  🎬 Scene Details
                </h5>
                
                <div className="space-y-4">
                  {/* Location */}
                  <div>
                    <label className="text-xs font-semibold text-gray-400 block mb-1">Location</label>
                    <select
                      value={selectedLocation}
                      onChange={(e) => handleLocationChange(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select a location...</option>
                      {LOCATION_OPTIONS.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.name} - {location.description}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Props */}
                  <div>
                    <label className="text-xs font-semibold text-gray-400 block mb-2">Props & Objects</label>
                    <div className="max-h-32 overflow-y-auto bg-gray-800 rounded border border-gray-600 p-2">
                      <div className="grid grid-cols-2 gap-1">
                        {PROP_OPTIONS.map((prop) => (
                          <label key={prop.id} className="flex items-center text-xs text-gray-300 cursor-pointer hover:text-white">
                            <input
                              type="checkbox"
                              checked={selectedProps.includes(prop.id)}
                              onChange={() => handlePropToggle(prop.id)}
                              className="mr-2 text-blue-500"
                            />
                            <span className="truncate" title={prop.description}>
                              {prop.name}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                    {selectedProps.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-400">Selected: {selectedProps.map(id => getPropById(id)?.name).join(', ')}</p>
                      </div>
                    )}
                  </div>

                  {/* Costumes */}
                  <div>
                    <label className="text-xs font-semibold text-gray-400 block mb-2">Costumes & Clothing</label>
                    <div className="max-h-32 overflow-y-auto bg-gray-800 rounded border border-gray-600 p-2">
                      <div className="grid grid-cols-2 gap-1">
                        {COSTUME_OPTIONS.map((costume) => (
                          <label key={costume.id} className="flex items-center text-xs text-gray-300 cursor-pointer hover:text-white">
                            <input
                              type="checkbox"
                              checked={selectedCostumes.includes(costume.id)}
                              onChange={() => handleCostumeToggle(costume.id)}
                              className="mr-2 text-blue-500"
                            />
                            <span className="truncate" title={costume.description}>
                              {costume.name}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                    {selectedCostumes.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-400">Selected: {selectedCostumes.map(id => getCostumeById(id)?.name).join(', ')}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Reality Blend: Optional background photo */}
              <div className="mt-3">
                <label className="text-xs font-semibold text-gray-400 block mb-1">Background Photo (optional)</label>
                {scene.backgroundImage ? (
                  <div className="flex items-center gap-3">
                    <img src={scene.backgroundImage} alt="background" className="w-24 h-16 object-cover rounded border border-gray-600" />
                    <button
                      onClick={() => onUpdateScene(scene.id, { backgroundImage: undefined })}
                      className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded"
                    >Remove</button>
                  </div>
                ) : (
                  <label className="inline-flex items-center justify-center px-3 py-2 text-xs border-2 border-dashed border-gray-600 rounded-md text-gray-400 cursor-pointer hover:border-amber-500 hover:text-amber-400 w-full sm:w-auto">
                    Upload Photo
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        const reader = new FileReader();
                        reader.onload = () => onUpdateScene(scene.id, { backgroundImage: reader.result as string });
                        reader.readAsDataURL(f);
                      }}
                    />
                  </label>
                )}
                <p className="text-[10px] text-gray-500 mt-1">If provided, Gemini will compose the character into this real photo with matching lighting.</p>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => onGenerateVariant(scene.id, scene.prompt)}
                  className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-3 py-2 rounded"
                >
                  Generate Variant
                </button>
                {scene.variantImageUrls && scene.variantImageUrls.length > 0 && (
                  <button
                    onClick={() => setIsCompareOpen(true)}
                    className="bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold px-3 py-2 rounded"
                  >
                    Compare
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="border-t border-gray-700 mt-4 pt-3 flex items-center justify-between">
            {isEditing ? (
              <div className="flex gap-2">
                <button onClick={handleSave} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md text-sm font-semibold">Save</button>
                <button onClick={handleCancel} className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-1 rounded-md text-sm">Cancel</button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                  <button
                      onClick={() => setIsEditing(true)}
                      className="text-gray-400 hover:text-white transition-colors p-2 rounded-md"
                      aria-label="Edit scene text"
                  >
                      <EditIcon className="w-5 h-5" />
                  </button>
                  {scene.status === 'success' && (
                      <button
                          onClick={() => setIsEditModalOpen(true)}
                          className="text-gray-400 hover:text-amber-400 transition-colors p-2 rounded-md"
                          aria-label="Edit image sequence"
                      >
                          <SparklesIcon className="w-5 h-5" />
                      </button>
                  )}
              </div>
            )}

            <button
              onClick={() => onDelete(scene.id)}
              className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-md"
              aria-label="Delete scene"
            >
              <TrashIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
      {scene.imageUrls && scene.imageUrls.length > 0 && (
          <EditSequenceModal
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            imageUrls={scene.imageUrls}
            onEditComplete={handleEditComplete}
          />
      )}
      {scene.imageUrls && scene.variantImageUrls && scene.variantImageUrls.length > 0 && (
        <CompareModal
          isOpen={isCompareOpen}
          onClose={() => setIsCompareOpen(false)}
          leftImages={scene.imageUrls}
          rightImages={scene.variantImageUrls}
        />
      )}
    </>
  );
};

export default SceneCard;
