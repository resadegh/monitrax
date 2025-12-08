'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, LayoutDashboard, PartyPopper } from 'lucide-react';
import { useGuidedTour, TourStep } from '@/hooks/useGuidedTour';
import { TourSpotlight } from './TourSpotlight';
import { TourTooltip } from './TourTooltip';
import '@/styles/tour-animations.css';

// Default Monitrax tour steps with icons
// Simplified to only target elements that exist
const monitraxTourSteps: TourStep[] = [
  {
    id: 'welcome',
    target: '',
    title: 'Welcome to Monitrax!',
    description: 'Monitrax helps you see your entire wealth, forecast your future cashflow, and optimise your debt & investments. Let\'s take a quick tour.',
    placement: 'center',
    icon: <Sparkles className="w-9 h-9 text-blue-500" />,
  },
  {
    id: 'sidebar',
    target: '[data-tour="sidebar"]',
    title: 'Navigation Sidebar',
    description: 'Your main navigation is here. You\'ll find Portfolio (properties, loans, accounts), Transactions (income, expenses), Planning (cashflow, strategy), and Reports.',
    placement: 'right',
    spotlightPadding: 0,
    icon: <LayoutDashboard className="w-6 h-6 text-blue-500" />,
  },
  {
    id: 'wrap-up',
    target: '',
    title: 'You\'re Ready to Go!',
    description: 'That\'s the basics! We recommend completing the quick setup wizard next so Monitrax can calculate your net worth and forecasts.',
    placement: 'center',
    icon: <PartyPopper className="w-9 h-9 text-blue-500" />,
  },
];

interface GuidedTourProps {
  steps?: TourStep[];
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  onSkip?: () => void;
  startStep?: number;
}

export function GuidedTour({
  steps = monitraxTourSteps,
  isOpen,
  onClose,
  onComplete,
  onSkip,
  startStep = 0,
}: GuidedTourProps) {
  // Handle SSR - only render portal after mounting on client
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const {
    currentStepIndex,
    currentStep,
    totalSteps,
    isFirstStep,
    isLastStep,
    targetPosition,
    isAnimating,
    nextStep,
    prevStep,
    goToStep,
    skipTour,
  } = useGuidedTour({
    steps,
    onComplete: () => {
      onComplete();
      onClose();
    },
    onSkip: () => {
      onSkip?.();
      onClose();
    },
    autoStart: isOpen,
  });

  // Don't render if not mounted (SSR), not open, or no current step
  if (!mounted || !isOpen || !currentStep) return null;

  // Use portal to render at document body level
  return createPortal(
    <>
      {/* Spotlight overlay */}
      <TourSpotlight
        isVisible={true}
        position={targetPosition}
        allowInteraction={currentStep.allowInteraction}
        pulse={!!targetPosition}
      />

      {/* Tooltip */}
      <TourTooltip
        title={currentStep.title}
        description={currentStep.description}
        icon={currentStep.icon}
        currentStep={currentStepIndex}
        totalSteps={totalSteps}
        placement={currentStep.placement || 'bottom'}
        targetPosition={targetPosition}
        isFirstStep={isFirstStep}
        isLastStep={isLastStep}
        isAnimating={isAnimating}
        onNext={nextStep}
        onPrev={prevStep}
        onSkip={skipTour}
        onGoToStep={goToStep}
      />
    </>,
    document.body
  );
}

// Export the default steps for customization
export { monitraxTourSteps };
