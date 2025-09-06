import React, { useEffect, useState } from 'react';
import type { CharacterOption } from '../types';
import { getDemoCharacters } from '../services/firebaseService';
import { generateCharacterOptions } from '../services/geminiService';

interface CharacterPickerProps {
  topic: string;
  open: boolean;
  onClose: () => void;
  onPick: (option: CharacterOption) => void;
  currentDescription?: string;
  currentImages?: string[];
}

const CharacterPicker: React.FC<CharacterPickerProps> = ({ topic, open, onClose, onPick, currentDescription, currentImages }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<CharacterOption[]>([]);
  const [count, setCount] = useState(4);
  const [styleHint, setStyleHint] = useState('');

  useEffect(() => {
    const load = async () => {
      if (!open) return;
      setLoading(true);
      setError(null);
      try {
        const demo = await getDemoCharacters();
        if (demo.length > 0) {
          setOptions(demo.map(d => ({ id: d.id, name: d.name, description: d.description, images: d.images })));
        } else {
          const gen = await generateCharacterOptions(topic, count, styleHint || undefined);
          setOptions(gen);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load characters');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [open, topic]);

  const regenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const gen = await generateCharacterOptions(topic, count, styleHint || undefined);
      setOptions(gen);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to regenerate');
    } finally {
      setLoading(false);
    }
  };

  const clearCacheAndRegenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const { clearCharacterOptionsCache } = await import('../services/geminiService');
      await clearCharacterOptionsCache(topic, count, styleHint || undefined);
      await regenerate();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to clear cache');
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-lg max-w-5xl w-full overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h3 className="text-white font-bold text-lg">Pick a Character</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        <div className="p-4">
          <div className="flex flex-col md:flex-row md:items-end gap-3 mb-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Style hint (optional)</label>
              <input value={styleHint} onChange={(e) => setStyleHint(e.target.value)} placeholder="e.g., Ghibli watercolor, Film noir" className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white w-full md:w-80" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Count</label>
              <select value={count} onChange={(e) => setCount(parseInt(e.target.value, 10))} className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white">
                {[2,3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="flex-1"></div>
            <button onClick={clearCacheAndRegenerate} disabled={loading} className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white font-semibold px-4 py-2 rounded">
              {loading ? 'Please wait…' : 'Clear cache'}
            </button>
            <button onClick={regenerate} disabled={loading} className="bg-amber-600 hover:bg-amber-700 disabled:bg-gray-700 text-white font-semibold px-4 py-2 rounded">
              {loading ? 'Please wait…' : 'Regenerate'}
            </button>
          </div>
          {loading && <div className="text-gray-300">Generating characters...</div>}
          {error && <div className="text-red-400 text-sm mb-3">{error}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {options.map(opt => {
              const selected = (currentDescription && opt.description === currentDescription) || (currentImages && currentImages.length && opt.images?.some(u => currentImages?.includes(u)));
              return (
              <button key={opt.id} onClick={() => onPick(opt)} className={`relative bg-gray-800 border border-gray-700 rounded-lg overflow-hidden text-left hover:bg-gray-700 transition-colors group ${selected ? 'ring-2 ring-amber-500' : ''}`}>
                {opt.images?.[0] && (
                  <img src={opt.images[0]} alt={opt.name} className="w-full h-40 object-cover" />
                )}
                <div className="p-3">
                  <div className="text-white font-semibold text-sm">{opt.name}</div>
                  <div className="text-gray-400 text-xs mt-1 line-clamp-3">{opt.description}</div>
                </div>
                {selected && <div className="absolute top-2 left-2 bg-amber-600 text-white text-xs font-semibold px-2 py-1 rounded">Selected</div>}
                <div className="absolute bottom-2 right-2 bg-amber-600 text-white text-xs font-semibold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">Use</div>
              </button>
            )})}
          </div>
          <div className="text-xs text-gray-500 mt-3">Tip: We generate a few options using Gemini. For the demo, this step uses cached or low‑count generations.</div>
        </div>
      </div>
    </div>
  );
};

export default CharacterPicker;
