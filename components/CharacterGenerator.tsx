import React, { useState } from 'react';
import { CharacterOption } from '../types';
import { generateCharacterOptions } from '../services/geminiService';
import { useToast } from './ToastProvider';
import Spinner from './Spinner';

interface CharacterGeneratorProps {
  topic: string;
  open: boolean;
  onClose: () => void;
  onGenerate: (characters: CharacterOption[]) => void;
  storyContent?: string; // Optional story content for character analysis
}

const CharacterGenerator: React.FC<CharacterGeneratorProps> = ({ 
  topic, 
  open, 
  onClose, 
  onGenerate,
  storyContent
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationMode, setGenerationMode] = useState<'ai' | 'manual'>('ai');
  const [characterCount, setCharacterCount] = useState(4);
  const [styleHint, setStyleHint] = useState('');
  
  // Manual character creation
  const [manualCharacters, setManualCharacters] = useState<CharacterOption[]>([
    { id: 'char-1', name: '', description: '', images: [] }
  ]);

  let toast: any = null;
  try {
    const toastContext = useToast();
    toast = toastContext.toast;
  } catch (error) {
    console.warn('Toast context not available:', error);
    toast = { info: () => {}, success: () => {}, error: () => {} };
  }

  const handleAIGeneration = async () => {
    if (!topic.trim()) {
      toast.error('Please enter a topic for character generation');
      return;
    }

    setIsGenerating(true);
    try {
      const characters = await generateCharacterOptions(topic, characterCount, styleHint || undefined, storyContent);
      onGenerate(characters);
      toast.success(`Generated ${characters.length} characters successfully!`);
      onClose();
    } catch (error) {
      console.error('Character generation failed:', error);
      toast.error('Failed to generate characters. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleManualGeneration = () => {
    const validCharacters = manualCharacters.filter(char => 
      char.name.trim() && char.description.trim()
    );
    
    if (validCharacters.length === 0) {
      toast.error('Please add at least one character with name and description');
      return;
    }

    onGenerate(validCharacters);
    toast.success(`Created ${validCharacters.length} characters successfully!`);
    onClose();
  };

  const addManualCharacter = () => {
    setManualCharacters(prev => [
      ...prev,
      { id: `char-${Date.now()}`, name: '', description: '', images: [] }
    ]);
  };

  const removeManualCharacter = (id: string) => {
    if (manualCharacters.length > 1) {
      setManualCharacters(prev => prev.filter(char => char.id !== id));
    }
  };

  const updateManualCharacter = (id: string, field: 'name' | 'description', value: string) => {
    setManualCharacters(prev => 
      prev.map(char => 
        char.id === id ? { ...char, [field]: value } : char
      )
    );
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white">Generate Additional Characters</h2>
              {storyContent && (
                <p className="text-sm text-green-400 mt-1">
                  ✨ Story-aware: Will analyze your story to generate matching characters
                </p>
              )}
              <p className="text-sm text-gray-400 mt-1">
                Characters are automatically generated when you create a story. Use this to generate more character options.
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Generation Mode Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Generation Mode
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="ai"
                  checked={generationMode === 'ai'}
                  onChange={(e) => setGenerationMode(e.target.value as 'ai' | 'manual')}
                  className="mr-2 text-amber-500"
                />
                <span className="text-white">AI Generated</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="manual"
                  checked={generationMode === 'manual'}
                  onChange={(e) => setGenerationMode(e.target.value as 'ai' | 'manual')}
                  className="mr-2 text-amber-500"
                />
                <span className="text-white">Manual Creation</span>
              </label>
            </div>
          </div>

          {generationMode === 'ai' ? (
            /* AI Generation Mode */
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Topic: {topic}
                </label>
                <p className="text-gray-400 text-sm">
                  Characters will be generated based on your story topic
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Number of Characters
                </label>
                <select
                  value={characterCount}
                  onChange={(e) => setCharacterCount(parseInt(e.target.value))}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:ring-amber-500 focus:border-amber-500"
                >
                  <option value={2}>2 Characters</option>
                  <option value={3}>3 Characters</option>
                  <option value={4}>4 Characters</option>
                  <option value={5}>5 Characters</option>
                  <option value={6}>6 Characters</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Style Hint (Optional)
                </label>
                <input
                  type="text"
                  value={styleHint}
                  onChange={(e) => setStyleHint(e.target.value)}
                  placeholder="e.g., 'anime style', 'realistic', 'cartoon', 'fantasy'"
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:ring-amber-500 focus:border-amber-500"
                />
                <p className="text-gray-400 text-xs mt-1">
                  Provide a style hint to influence the character generation
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleAIGeneration}
                  disabled={isGenerating}
                  className="bg-amber-500 hover:bg-amber-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg transition-colors flex items-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <Spinner />
                      Generating Characters...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Generate with AI
                    </>
                  )}
                </button>
                <button
                  onClick={onClose}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            /* Manual Creation Mode */
            <div className="space-y-6">
              <div>
                <p className="text-gray-400 text-sm mb-4">
                  Create characters manually by providing their names and descriptions
                </p>
              </div>

              {manualCharacters.map((character, index) => (
                <div key={character.id} className="bg-gray-700 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-white">
                      Character {index + 1}
                    </h3>
                    {manualCharacters.length > 1 && (
                      <button
                        onClick={() => removeManualCharacter(character.id)}
                        className="text-red-400 hover:text-red-300 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Character Name
                      </label>
                      <input
                        type="text"
                        value={character.name}
                        onChange={(e) => updateManualCharacter(character.id, 'name', e.target.value)}
                        placeholder="e.g., Luna, Captain Alex, Dr. Smith"
                        className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:ring-amber-500 focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Character Description
                      </label>
                      <textarea
                        value={character.description}
                        onChange={(e) => updateManualCharacter(character.id, 'description', e.target.value)}
                        placeholder="Describe the character's appearance, personality, role, etc."
                        rows={3}
                        className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:ring-amber-500 focus:border-amber-500"
                      />
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex gap-3">
                <button
                  onClick={addManualCharacter}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Add Character
                </button>
                <button
                  onClick={handleManualGeneration}
                  className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-lg transition-colors flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Create Characters
                </button>
                <button
                  onClick={onClose}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CharacterGenerator;

