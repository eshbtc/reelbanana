import React from 'react';
import { Scene } from '../types';
import { calculateSceneCost, calculateTotalCost, formatCredits, getCostTier } from '../utils/costCalculator';

interface CostEstimatorProps {
  scenes: Scene[];
  showPerScene?: boolean;
  className?: string;
}

export const CostEstimator: React.FC<CostEstimatorProps> = ({
  scenes,
  showPerScene = false,
  className = '',
}) => {
  if (scenes.length === 0) {
    return null;
  }

  const totalCost = calculateTotalCost(scenes);
  const costTier = getCostTier(totalCost.total);

  return (
    <div className={`bg-gray-800 border border-gray-700 rounded-lg p-4 ${className}`}>
      <h3 className="text-lg font-semibold text-white mb-3">Cost Estimation</h3>
      
      {/* Total Cost */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-300">Total Credits Required</span>
          <span className={`text-xl font-bold ${costTier.color}`}>
            {formatCredits(totalCost.total)}
          </span>
        </div>
        <div className="text-sm text-gray-400">
          {costTier.description}
        </div>
      </div>

      {/* Cost Breakdown */}
      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Image Generation</span>
          <span className="text-gray-300">{formatCredits(totalCost.breakdown.imageGeneration)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Narration</span>
          <span className="text-gray-300">{formatCredits(totalCost.breakdown.narration)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Video Rendering</span>
          <span className="text-gray-300">{formatCredits(totalCost.breakdown.videoRendering)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Pro Polish</span>
          <span className="text-gray-300">{formatCredits(totalCost.breakdown.proPolish)}</span>
        </div>
      </div>

      {/* Per Scene Breakdown */}
      {showPerScene && scenes.length > 1 && (
        <div className="border-t border-gray-700 pt-4">
          <h4 className="text-sm font-semibold text-gray-300 mb-2">Per Scene</h4>
          <div className="space-y-1">
            {totalCost.perScene.map((scene, index) => {
              const sceneCost = calculateSceneCost(scenes[index]);
              const sceneTier = getCostTier(sceneCost.total);
              return (
                <div key={index} className="flex justify-between text-sm">
                  <span className="text-gray-400">Scene {index + 1}</span>
                  <span className={sceneTier.color}>{formatCredits(sceneCost.total)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cost Tips */}
      <div className="border-t border-gray-700 pt-3 mt-4">
        <div className="text-xs text-gray-400">
          💡 <strong>Tip:</strong> Credits are only used when operations complete successfully. 
          Failed operations are automatically refunded.
        </div>
      </div>
    </div>
  );
};
