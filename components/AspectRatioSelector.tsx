import React from 'react';
import { AspectRatio, AspectRatioConfig } from '../types';
import { ASPECT_RATIOS, isAspectRatioAvailable } from '../lib/exportPresets';
import { PlanTier } from '../lib/planMapper';

interface AspectRatioSelectorProps {
  selectedAspectRatio: AspectRatio;
  onAspectRatioChange: (aspectRatio: AspectRatio) => void;
  userPlan?: 'free' | 'plus' | 'pro' | 'studio';
  disabled?: boolean;
  className?: string;
}

const AspectRatioSelector: React.FC<AspectRatioSelectorProps> = ({
  selectedAspectRatio,
  onAspectRatioChange,
  userPlan = 'free',
  disabled = false,
  className = ''
}) => {
  const selectedConfig = ASPECT_RATIOS.find(ratio => ratio.id === selectedAspectRatio);

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-200">Aspect Ratio</h3>
        {selectedConfig && (
          <span className="text-xs text-gray-400">
            {selectedConfig.width} × {selectedConfig.height}
          </span>
        )}
      </div>
      
      <div className="grid grid-cols-3 gap-2">
        {ASPECT_RATIOS.map((ratio) => {
          const isSelected = ratio.id === selectedAspectRatio;
          const isAvailable = isAspectRatioAvailable(ratio, userPlan as PlanTier);
          const isDisabled = disabled || !isAvailable;
          
          return (
            <button
              key={ratio.id}
              onClick={() => !isDisabled && onAspectRatioChange(ratio.id)}
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
                <div className="text-2xl">{ratio.icon}</div>
                <div className="text-center">
                  <div className="text-xs font-medium text-gray-200">
                    {ratio.name}
                  </div>
                  <div className="text-xs text-gray-400">
                    {ratio.id}
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
          {selectedConfig.description}
        </div>
      )}
      
      {userPlan === 'free' && (
        <div className="text-xs text-amber-400 bg-amber-500/10 p-2 rounded border border-amber-500/20">
          💡 Upgrade to Plus or Pro for more aspect ratio options
        </div>
      )}
    </div>
  );
};

export default AspectRatioSelector;

