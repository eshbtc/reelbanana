import React from 'react';
import { Scene } from '../types';
import { calculateSceneCost } from '../utils/costCalculator';

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

  // Calculate real dollar costs for each scene
  const sceneCosts = scenes.map(scene => {
    // Assume 5 frames per scene and 8 seconds of video
    return calculateSceneCost(scene, 5, 8);
  });

  // Calculate totals
  const totalImageCost = sceneCosts.reduce((sum, cost) => sum + cost.imageGeneration, 0);
  const totalNarrationCost = sceneCosts.reduce((sum, cost) => sum + cost.narration, 0);
  const totalVideoCost = sceneCosts.reduce((sum, cost) => sum + cost.videoRendering, 0);
  const totalCost = totalImageCost + totalNarrationCost + totalVideoCost;

  // Format currency
  const formatCost = (cost: number) => {
    return cost >= 1 ? `$${cost.toFixed(2)}` : `$${cost.toFixed(3)}`;
  };

  // Get cost tier for styling
  const getCostColor = (cost: number) => {
    if (cost < 0.5) return 'text-green-400';
    if (cost < 2) return 'text-yellow-400';
    return 'text-orange-400';
  };

  return (
    <div className={`bg-gray-800/50 backdrop-blur border border-gray-700 rounded-lg p-4 ${className}`}>
      <h3 className="text-lg font-semibold text-white mb-3">Estimated Cost</h3>

      {/* Total Cost Display */}
      <div className="mb-4 p-3 bg-gray-900/50 rounded-lg">
        <div className="flex items-center justify-between">
          <span className="text-gray-300">Total Cost</span>
          <span className={`text-2xl font-bold ${getCostColor(totalCost)}`}>
            {formatCost(totalCost)}
          </span>
        </div>
        <div className="text-xs text-gray-500 mt-1">
          *Actual costs based on AI model usage
        </div>
      </div>

      {/* Cost Breakdown */}
      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Image Generation ({scenes.length * 5} frames)</span>
          <span className="text-gray-300">{formatCost(totalImageCost)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Narration</span>
          <span className="text-gray-300">{formatCost(totalNarrationCost)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Video Generation (Veo3 Fast)</span>
          <span className="text-gray-300 font-semibold">{formatCost(totalVideoCost)}</span>
        </div>
      </div>

      {/* Per Scene Breakdown */}
      {showPerScene && scenes.length > 1 && (
        <div className="border-t border-gray-700 pt-4">
          <h4 className="text-sm font-semibold text-gray-300 mb-2">Per Scene</h4>
          <div className="space-y-1">
            {sceneCosts.map((cost, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span className="text-gray-400">Scene {index + 1}</span>
                  <span className={getCostColor(cost.total)}>{formatCost(cost.total)}</span>
                </div>
            ))}
          </div>
        </div>
      )}

      {/* Cost Tips */}
      <div className="border-t border-gray-700 pt-3 mt-4">
        <div className="text-xs text-gray-400">
          💡 <strong>Note:</strong> Video generation (Veo3) accounts for ~70% of costs.
          Shorter videos save money.
        </div>
      </div>
    </div>
  );
};
