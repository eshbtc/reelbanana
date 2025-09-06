import React, { useState } from 'react';
import Modal from './Modal';
import Spinner from './Spinner';
import { editImageSequence } from '../services/geminiService';
import { SparklesIcon } from './Icon';

interface EditSequenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrls: string[];
  onEditComplete: (newImageUrls: string[]) => void;
}

const EditSequenceModal: React.FC<EditSequenceModalProps> = ({ isOpen, onClose, imageUrls, onEditComplete }) => {
  const [editPrompt, setEditPrompt] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApplyEdit = async () => {
    if (!editPrompt.trim()) {
      setError("Please enter a description of the change you want to make.");
      return;
    }
    setIsEditing(true);
    setError(null);
    try {
      const newImageUrls = await editImageSequence(imageUrls, editPrompt);
      onEditComplete(newImageUrls);
      onClose();
      setEditPrompt('');
    } catch (e) {
      setError(e instanceof Error ? e.message : "An unknown error occurred during editing.");
    } finally {
      setIsEditing(false);
    }
  };

  const handleClose = () => {
      if (isEditing) return;
      onClose();
      setError(null);
      setEditPrompt('');
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <div className="text-white">
        <h2 className="text-2xl font-bold mb-4 text-amber-400">Edit Image Sequence</h2>
        <p className="text-gray-400 mb-4 text-sm">Describe a change to apply to all images in this scene. This works best for adding objects, changing colors, or altering the background.</p>
        
        <div className="grid grid-cols-5 gap-2 mb-4">
          {imageUrls.map((url, index) => (
            <img key={index} src={url} alt={`Frame ${index + 1}`} className="w-full h-auto object-cover rounded-md bg-gray-700" />
          ))}
        </div>

        <textarea
          value={editPrompt}
          onChange={(e) => setEditPrompt(e.target.value)}
          placeholder="e.g., add a small, friendly robot in the background"
          className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-amber-500 focus:outline-none transition mb-4"
          rows={2}
          disabled={isEditing}
        />

        {error && <p className="text-red-400 mb-4 text-sm">{error}</p>}

        <div className="flex justify-end gap-4">
          <button 
            onClick={handleClose}
            disabled={isEditing}
            className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleApplyEdit}
            disabled={isEditing}
            className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 px-6 rounded-lg transition-all flex items-center justify-center gap-2 disabled:bg-gray-600 disabled:cursor-wait"
          >
            {isEditing ? <Spinner /> : <SparklesIcon className="w-5 h-5"/>}
            {isEditing ? 'Applying...' : 'Apply Edit'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default EditSequenceModal;
