// Fix: Implement the SceneCard component. This file was previously invalid.
import React, { useState, useEffect } from 'react';
import { Scene, CameraMovement, TransitionType } from '../types';
import { TrashIcon, SparklesIcon, EditIcon } from './Icon';
import Spinner from './Spinner';
import EditSequenceModal from './EditSequenceModal';

interface SceneCardProps {
  scene: Scene;
  index: number;
  onDelete: (id: string) => void;
  onGenerateImage: (id: string, prompt: string) => void;
  onUpdateScene: (id: string, updates: Partial<Pick<Scene, 'prompt' | 'narration' | 'camera' | 'transition' | 'duration'>>) => void;
  onUpdateSequence: (id: string, newImageUrls: string[]) => void;
}

const SceneCard: React.FC<SceneCardProps> = ({ scene, index, onDelete, onGenerateImage, onUpdateScene, onUpdateSequence }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState(scene.prompt);
  const [editedNarration, setEditedNarration] = useState(scene.narration);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    if (scene.status === 'success' && scene.imageUrls && scene.imageUrls.length > 1) {
      const intervalId = setInterval(() => {
        setCurrentImageIndex(prevIndex => (prevIndex + 1) % scene.imageUrls!.length);
      }, 800); // Change image every 800ms
      return () => clearInterval(intervalId);
    }
  }, [scene.status, scene.imageUrls]);

  const handleSave = () => {
    onUpdateScene(scene.id, { prompt: editedPrompt, narration: editedNarration });
    setIsEditing(false);
  };
  
  const handleCancel = () => {
    setEditedPrompt(scene.prompt);
    setEditedNarration(scene.narration);
    setIsEditing(false);
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
            <img 
                src={scene.imageUrls[currentImageIndex]} 
                alt={`${scene.prompt} - frame ${currentImageIndex + 1}`} 
                className="w-full h-full object-cover transition-opacity duration-300" 
            />
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
          </div>
        );
    }
  };

  return (
    <>
      <div className="bg-gray-800 rounded-lg overflow-hidden shadow-lg border border-gray-700 flex flex-col">
        <div className="relative h-48 bg-gray-700">
          {renderImageContent()}
          <div className="absolute top-2 left-2 bg-black/60 text-white text-sm font-bold px-3 py-1 rounded-full">
            Scene {index + 1}
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
                <p className="text-gray-400 text-xs"><strong className="font-semibold">Prompt:</strong> {scene.prompt}</p>
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
    </>
  );
};

export default SceneCard;