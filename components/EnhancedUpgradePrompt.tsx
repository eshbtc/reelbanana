import React, { useState } from 'react';
import { PlanTier, getPlanConfig } from '../lib/planMapper';
import { PlanGateResult } from '../services/planGatingService';
import { useUserPlan } from '../hooks/useUserPlan';
import PlanComparisonModal from './PlanComparisonModal';

interface EnhancedUpgradePromptProps {
  gateResult: PlanGateResult;
  onUpgrade?: (suggestedPlan: PlanTier) => void;
  onDismiss?: () => void;
  className?: string;
  variant?: 'banner' | 'modal' | 'inline' | 'toast';
  showComparison?: boolean;
}

export const EnhancedUpgradePrompt: React.FC<EnhancedUpgradePromptProps> = ({
  gateResult,
  onUpgrade,
  onDismiss,
  className = '',
  variant = 'banner',
  showComparison = false
}) => {
  const { planTier: currentPlan } = useUserPlan();
  const [showPricingModal, setShowPricingModal] = useState(false);
  
  if (!gateResult.upgradeRequired) {
    return null;
  }

  const suggestedPlanConfig = gateResult.suggestedPlan ? getPlanConfig(gateResult.suggestedPlan) : null;
  const currentPlanConfig = getPlanConfig(currentPlan);

  const handleUpgrade = () => {
    if (onUpgrade && gateResult.suggestedPlan) {
      onUpgrade(gateResult.suggestedPlan);
    } else {
      setShowPricingModal(true);
    }
  };

  const getFeatureIcon = (feature: string) => {
    switch (feature) {
      case 'high_resolution': return '🎥';
      case 'pro_polish': return '✨';
      case 'scene_limit': return '📽️';
      case 'duration_limit': return '⏱️';
      case 'daily_renders': return '🔄';
      case 'watermark_removal': return '🏷️';
      case 'byo_api_keys': return '🔑';
      case 'custom_branding': return '🎨';
      case 'api_access': return '🔌';
      case 'team_seats': return '👥';
      default: return '⭐';
    }
  };

  const getFeatureName = (feature: string) => {
    switch (feature) {
      case 'high_resolution': return 'High Resolution Rendering';
      case 'pro_polish': return 'Pro Polish';
      case 'scene_limit': return 'More Scenes';
      case 'duration_limit': return 'Longer Videos';
      case 'daily_renders': return 'More Daily Renders';
      case 'watermark_removal': return 'Remove Watermark';
      case 'byo_api_keys': return 'Bring Your Own API Keys';
      case 'custom_branding': return 'Custom Branding';
      case 'api_access': return 'API Access';
      case 'team_seats': return 'Team Seats';
      default: return 'Premium Feature';
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'banner':
        return 'bg-gradient-to-r from-amber-900/30 to-orange-900/30 border border-amber-500/50 rounded-lg p-4';
      case 'modal':
        return 'bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-md mx-auto';
      case 'inline':
        return 'bg-gray-800/50 border border-gray-600 rounded-lg p-3';
      case 'toast':
        return 'bg-gray-900 border border-amber-500/50 rounded-lg p-4 shadow-lg';
      default:
        return 'bg-gradient-to-r from-amber-900/30 to-orange-900/30 border border-amber-500/50 rounded-lg p-4';
    }
  };

  const renderContent = () => (
    <div className={`${getVariantStyles()} ${className}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <div className="w-8 h-8 bg-amber-500/20 rounded-full flex items-center justify-center">
            <span className="text-lg">{getFeatureIcon(gateResult.feature)}</span>
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-white">
              {getFeatureName(gateResult.feature)}
            </h3>
            {variant !== 'toast' && onDismiss && (
              <button
                onClick={onDismiss}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          
          <p className="text-sm text-gray-300 mb-3">
            {gateResult.reason}
          </p>
          
          {suggestedPlanConfig && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-400">Upgrade to</span>
                <span className="text-sm font-semibold text-amber-400">
                  {suggestedPlanConfig.name}
                </span>
                <span className="text-xs text-gray-400">
                  (${suggestedPlanConfig.price}/month)
                </span>
              </div>
              
              {showComparison && (
                <div className="text-xs text-gray-400 space-y-1">
                  <div className="flex justify-between">
                    <span>Current: {currentPlanConfig.name}</span>
                    <span>→ {suggestedPlanConfig.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Max Scenes: {currentPlanConfig.limits.maxScenes}</span>
                    <span>→ {suggestedPlanConfig.limits.maxScenes}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Resolution: {currentPlanConfig.limits.resolution}</span>
                    <span>→ {suggestedPlanConfig.limits.resolution}</span>
                  </div>
                </div>
              )}
            </div>
          )}
          
          <div className="flex gap-2">
            <button
              onClick={handleUpgrade}
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors duration-200"
            >
              Upgrade Now
            </button>
            
            {variant === 'banner' && (
              <button
                onClick={() => setShowPricingModal(true)}
                className="px-4 py-2 text-sm text-amber-400 hover:text-amber-300 border border-amber-500/50 rounded-lg transition-colors duration-200"
              >
                Compare Plans
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (variant === 'modal') {
    return (
      <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4">
        {renderContent()}
      </div>
    );
  }

  return (
    <>
      {renderContent()}
      {showPricingModal && (
        <PlanComparisonModal
          open={showPricingModal}
          onClose={() => setShowPricingModal(false)}
          suggestedPlan={gateResult?.suggestedPlan as any}
        />
      )}
    </>
  );
};

// Hook for easy plan gating integration
export function usePlanGate(feature: string, currentState?: any) {
  const [gateResult, setGateResult] = useState<PlanGateResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  React.useEffect(() => {
    const checkGate = async () => {
      try {
        setIsLoading(true);
        const { checkPlanGate } = await import('../services/planGatingService');
        const result = await checkPlanGate({ feature, currentState });
        setGateResult(result);
      } catch (error) {
        console.error('Plan gate check failed:', error);
        setGateResult({
          allowed: false,
          reason: 'Unable to verify permissions',
          currentPlan: 'free',
          feature
        });
      } finally {
        setIsLoading(false);
      }
    };

    checkGate();
  }, [feature, currentState]);

  return { gateResult, isLoading };
}




