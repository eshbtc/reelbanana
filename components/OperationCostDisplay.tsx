import React from 'react';
import { OPERATION_COSTS, formatCredits, validateCredits } from '../utils/costCalculator';
import { useUserCredits } from '../hooks/useUserCredits';

interface OperationCostDisplayProps {
  operation: keyof typeof OPERATION_COSTS;
  params?: any;
  onInsufficientCredits?: () => void;
  className?: string;
}

export const OperationCostDisplay: React.FC<OperationCostDisplayProps> = ({
  operation,
  params,
  onInsufficientCredits,
  className = '',
}) => {
  const { freeCredits, isAdmin } = useUserCredits();

  // Calculate required credits based on operation and params
  const getRequiredCredits = () => {
    const baseCost = OPERATION_COSTS[operation];
    
    switch (operation) {
      case 'imageGeneration':
        return baseCost * (params?.imageCount || 1);
      case 'narration':
        const charCount = params?.text?.length || 0;
        return Math.ceil(charCount / 100) * baseCost;
      default:
        return baseCost;
    }
  };

  const requiredCredits = getRequiredCredits();
  const validation = validateCredits(freeCredits, requiredCredits, isAdmin);

  const getOperationName = () => {
    switch (operation) {
      case 'storyGeneration': return 'Story Generation';
      case 'imageGeneration': return 'Image Generation';
      case 'narration': return 'Narration';
      case 'videoRendering': return 'Video Rendering';
      case 'proPolish': return 'Pro Polish';
      case 'musicGeneration': return 'Music Generation';
      default: return operation;
    }
  };

  const getOperationDescription = () => {
    switch (operation) {
      case 'storyGeneration': return 'Generate story scenes and narrative';
      case 'imageGeneration': return `Generate ${params?.imageCount || 1} images`;
      case 'narration': return `Convert ${params?.text?.length || 0} characters to speech`;
      case 'videoRendering': return 'Render final video with effects';
      case 'proPolish': return 'Upscale and enhance video quality';
      case 'musicGeneration': return 'Generate background music';
      default: return 'AI operation';
    }
  };

  return (
    <div className={`bg-gray-800 border border-gray-700 rounded-lg p-3 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h4 className="text-sm font-semibold text-white">{getOperationName()}</h4>
          <p className="text-xs text-gray-400">{getOperationDescription()}</p>
        </div>
        <div className="text-right">
          <div className={`text-sm font-semibold ${validation.valid ? 'text-green-400' : 'text-red-400'}`}>
            {formatCredits(requiredCredits)}
          </div>
          {!validation.valid && (
            <div className="text-xs text-red-400">
              Need {formatCredits(requiredCredits - freeCredits)} more
            </div>
          )}
        </div>
      </div>

      {/* Credit Status */}
      <div className="flex items-center gap-2 text-xs">
        <div className={`w-2 h-2 rounded-full ${validation.valid ? 'bg-green-500' : 'bg-red-500'}`}></div>
        <span className={validation.valid ? 'text-green-400' : 'text-red-400'}>
          {validation.valid ? 'Credits available' : 'Insufficient credits'}
        </span>
        {isAdmin && (
          <span className="text-amber-400 ml-2">(Admin - Unlimited)</span>
        )}
      </div>

      {/* Insufficient Credits Warning */}
      {!validation.valid && onInsufficientCredits && (
        <div className="mt-3 p-2 bg-red-900/20 border border-red-500/30 rounded text-xs text-red-300">
          <div className="flex items-center justify-between">
            <span>{validation.reason}</span>
            <button
              onClick={onInsufficientCredits}
              className="ml-2 px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs transition-colors"
            >
              Buy Credits
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
