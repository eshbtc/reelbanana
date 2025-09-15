import React from 'react';
import { ExportPreset, ExportPresetConfig } from '../types';
import { EXPORT_PRESETS, isExportPresetAvailable } from '../lib/exportPresets';
import { PlanTier } from '../lib/planMapper';

interface ExportPresetSelectorProps {
  selectedPreset: ExportPreset;
  onPresetChange: (preset: ExportPreset) => void;
  userPlan?: 'free' | 'plus' | 'pro' | 'studio';
  disabled?: boolean;
  className?: string;
}

const ExportPresetSelector: React.FC<ExportPresetSelectorProps> = ({
  selectedPreset,
  onPresetChange,
  userPlan = 'free',
  disabled = false,
  className = ''
}) => {
  const selectedConfig = EXPORT_PRESETS.find(preset => preset.id === selectedPreset);

  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'youtube': return '🎥';
      case 'tiktok': return '🎵';
      case 'instagram': return '📸';
      default: return '⚙️';
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-200">Export Preset</h3>
        {selectedConfig && (
          <span className="text-xs text-gray-400">
            {selectedConfig.resolution.width} × {selectedConfig.resolution.height}
          </span>
        )}
      </div>
      
      <div className="grid grid-cols-2 gap-2">
        {EXPORT_PRESETS.map((preset) => {
          const isSelected = preset.id === selectedPreset;
          const isAvailable = isExportPresetAvailable(preset, userPlan as PlanTier);
          const isDisabled = disabled || !isAvailable;
          
          return (
            <button
              key={preset.id}
              onClick={() => !isDisabled && onPresetChange(preset.id)}
              disabled={isDisabled}
              className={`
                relative p-3 rounded-lg border-2 transition-all duration-200
                ${isSelected 
                  ? 'border-amber-500 bg-amber-500/10' 
                  : isAvailable
                    ? 'border-gray-600 hover:border-gray-500'
                    : 'border-gray-700 bg-gray-800/30'
                }
                ${isDisabled 
                  ? 'opacity-50 cursor-not-allowed' 
                  : 'cursor-pointer hover:bg-gray-700/50'
                }
              `}
            >
              <div className="flex flex-col items-center space-y-2">
                <div className="text-2xl">{getPlatformIcon(preset.platform)}</div>
                <div className="text-center">
                  <div className="text-xs font-medium text-gray-200">
                    {preset.name}
                  </div>
                  <div className="text-xs text-gray-400">
                    {preset.aspectRatio}
                  </div>
                </div>
              </div>
              
              {isSelected && (
                <div className="absolute top-1 right-1">
                  <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                </div>
              )}
              
              {!isAvailable && (
                <div className="absolute top-1 left-1">
                  <div className="w-4 h-4 bg-gray-600 rounded-full flex items-center justify-center">
                    <span className="text-xs text-gray-300">🔒</span>
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>
      
      {selectedConfig && (
        <div className="text-xs text-gray-400 bg-gray-800/50 p-2 rounded">
          <div className="font-medium mb-1">{selectedConfig.description}</div>
          <div className="text-gray-500">
            Resolution: {selectedConfig.resolution.width} × {selectedConfig.resolution.height} • 
            Bitrate: {selectedConfig.bitrate} • 
            Format: {selectedConfig.container.toUpperCase()}
          </div>
        </div>
      )}
      
      {userPlan === 'free' && (
        <div className="text-xs text-amber-400 bg-amber-500/10 p-2 rounded border border-amber-500/20">
          💡 Upgrade to Plus or Pro for more export options
        </div>
      )}
    </div>
  );
};

export default ExportPresetSelector;

