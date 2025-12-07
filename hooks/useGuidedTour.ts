'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

export interface TourStep {
  id: string;
  target: string;                    // CSS selector for the element to highlight
  title: string;
  description: string;
  icon?: React.ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  spotlightPadding?: number;         // Extra padding around the spotlight
  allowInteraction?: boolean;        // Allow clicking the highlighted element
  onEnter?: () => void;              // Callback when entering this step
  onExit?: () => void;               // Callback when leaving this step
}

interface TourPosition {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface UseGuidedTourOptions {
  steps: TourStep[];
  onComplete?: () => void;
  onSkip?: () => void;
  onStepChange?: (stepIndex: number) => void;
  autoStart?: boolean;
}

interface UseGuidedTourReturn {
  // State
  isOpen: boolean;
  currentStepIndex: number;
  currentStep: TourStep | null;
  totalSteps: number;
  isFirstStep: boolean;
  isLastStep: boolean;
  targetPosition: TourPosition | null;
  isAnimating: boolean;

  // Actions
  startTour: () => void;
  endTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (index: number) => void;
  skipTour: () => void;
}

// Animation timings (in ms)
const ANIMATION = {
  TOOLTIP_FADE_OUT: 200,
  SPOTLIGHT_MOVE: 400,
  TOOLTIP_FADE_IN: 300,
  TOTAL: 900,
};

export function useGuidedTour({
  steps,
  onComplete,
  onSkip,
  onStepChange,
  autoStart = false,
}: UseGuidedTourOptions): UseGuidedTourReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetPosition, setTargetPosition] = useState<TourPosition | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevStepRef = useRef<number>(-1);

  const currentStep = steps[currentStepIndex] || null;
  const totalSteps = steps.length;
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === totalSteps - 1;

  // Get element position for spotlight
  const updateTargetPosition = useCallback(() => {
    if (!currentStep) {
      setTargetPosition(null);
      return;
    }

    // For center placement (welcome/intro steps), no target needed
    if (currentStep.placement === 'center' || !currentStep.target) {
      setTargetPosition(null);
      return;
    }

    const element = document.querySelector(currentStep.target);
    if (!element) {
      console.warn(`Tour target not found: ${currentStep.target}`);
      setTargetPosition(null);
      return;
    }

    const rect = element.getBoundingClientRect();
    const padding = currentStep.spotlightPadding || 8;

    setTargetPosition({
      top: rect.top - padding + window.scrollY,
      left: rect.left - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
    });

    // Scroll element into view if needed
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentStep]);

  // Update position on step change and window resize
  useEffect(() => {
    if (!isOpen) return;

    updateTargetPosition();

    const handleResize = () => updateTargetPosition();
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize);
    };
  }, [isOpen, currentStepIndex, updateTargetPosition]);

  // Handle step change callbacks
  useEffect(() => {
    if (!isOpen || prevStepRef.current === currentStepIndex) return;

    // Call onExit for previous step
    if (prevStepRef.current >= 0 && prevStepRef.current < steps.length) {
      steps[prevStepRef.current]?.onExit?.();
    }

    // Call onEnter for current step
    currentStep?.onEnter?.();

    // Notify parent of step change
    onStepChange?.(currentStepIndex);

    prevStepRef.current = currentStepIndex;
  }, [isOpen, currentStepIndex, currentStep, steps, onStepChange]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case 'Enter':
          if (!isLastStep) nextStep();
          else endTour();
          break;
        case 'ArrowLeft':
          if (!isFirstStep) prevStep();
          break;
        case 'Escape':
          skipTour();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isFirstStep, isLastStep]);

  const startTour = useCallback(() => {
    setCurrentStepIndex(0);
    setIsOpen(true);
    prevStepRef.current = -1;
  }, []);

  const endTour = useCallback(() => {
    currentStep?.onExit?.();
    setIsOpen(false);
    setCurrentStepIndex(0);
    setTargetPosition(null);
    prevStepRef.current = -1;
    onComplete?.();
  }, [currentStep, onComplete]);

  const skipTour = useCallback(() => {
    currentStep?.onExit?.();
    setIsOpen(false);
    setCurrentStepIndex(0);
    setTargetPosition(null);
    prevStepRef.current = -1;
    onSkip?.();
  }, [currentStep, onSkip]);

  const goToStep = useCallback((index: number) => {
    if (index < 0 || index >= totalSteps || isAnimating) return;

    setIsAnimating(true);

    // Animate transition
    setTimeout(() => {
      setCurrentStepIndex(index);
    }, ANIMATION.TOOLTIP_FADE_OUT);

    setTimeout(() => {
      setIsAnimating(false);
    }, ANIMATION.TOTAL);
  }, [totalSteps, isAnimating]);

  const nextStep = useCallback(() => {
    if (isLastStep) {
      endTour();
    } else {
      goToStep(currentStepIndex + 1);
    }
  }, [isLastStep, endTour, goToStep, currentStepIndex]);

  const prevStep = useCallback(() => {
    if (!isFirstStep) {
      goToStep(currentStepIndex - 1);
    }
  }, [isFirstStep, goToStep, currentStepIndex]);

  // Auto-start if configured
  useEffect(() => {
    if (autoStart && !isOpen) {
      startTour();
    }
  }, [autoStart, isOpen, startTour]);

  return {
    isOpen,
    currentStepIndex,
    currentStep,
    totalSteps,
    isFirstStep,
    isLastStep,
    targetPosition,
    isAnimating,
    startTour,
    endTour,
    nextStep,
    prevStep,
    goToStep,
    skipTour,
  };
}

// Default tour steps for Monitrax
export const defaultTourSteps: TourStep[] = [
  {
    id: 'welcome',
    target: '',
    title: 'Welcome to Monitrax!',
    description: 'Monitrax helps you see your entire wealth, forecast your future cashflow, and optimise your debt & investments. Let\'s take a quick tour.',
    placement: 'center',
  },
  {
    id: 'sidebar',
    target: '[data-tour="sidebar"]',
    title: 'Navigation Sidebar',
    description: 'Here are your main sections: Dashboard, Properties, Loans, Investments, Income & Expenses, Tax & Strategy.',
    placement: 'right',
    spotlightPadding: 0,
  },
  {
    id: 'dashboard',
    target: '[data-tour="dashboard-stats"]',
    title: 'Dashboard Overview',
    description: 'Your dashboard shows your net worth, cashflow, and key portfolio metrics at a glance.',
    placement: 'bottom',
  },
  {
    id: 'properties',
    target: '[data-tour="nav-properties"]',
    title: 'Properties',
    description: 'Track each property\'s value, loans, rental income, expenses and depreciation.',
    placement: 'right',
  },
  {
    id: 'loans',
    target: '[data-tour="nav-loans"]',
    title: 'Loans',
    description: 'See your loan balances, interest rates, offset accounts and repayment details.',
    placement: 'right',
  },
  {
    id: 'investments',
    target: '[data-tour="nav-investments"]',
    title: 'Investments',
    description: 'Monitor investment accounts, holdings and transactions, and link them to income like dividends.',
    placement: 'right',
  },
  {
    id: 'income-expenses',
    target: '[data-tour="nav-transactions"]',
    title: 'Income & Expenses',
    description: 'Categorise your inflows and outflows for cashflow and strategy recommendations.',
    placement: 'right',
  },
  {
    id: 'strategy',
    target: '[data-tour="nav-strategy"]',
    title: 'Strategy Engine',
    description: 'Use the Strategy Engine to explore scenarios and optimisations based on your data.',
    placement: 'right',
  },
  {
    id: 'wrap-up',
    target: '',
    title: 'You\'re Ready!',
    description: 'You\'re all set to explore Monitrax. Next, we recommend completing the quick setup so Monitrax can calculate your net worth and forecasts.',
    placement: 'center',
  },
];
