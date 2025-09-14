import React from 'react';
import { PlanComparisonModal } from './PlanComparisonModal';

interface PricingModalProps {
  open: boolean;
  onClose: () => void;
  suggestedPlan?: 'free' | 'plus' | 'pro' | 'studio';
  feature?: string;
}

const PricingModal: React.FC<PricingModalProps> = ({ 
  open, 
  onClose, 
  suggestedPlan, 
  feature 
}) => {
  return (
    <PlanComparisonModal
      isOpen={open}
      onClose={onClose}
      suggestedPlan={suggestedPlan}
      feature={feature}
    />
  );
};

export default PricingModal;

