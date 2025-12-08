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

// Default tour steps for Monitrax - comprehensive tour of all sections
export const defaultTourSteps: TourStep[] = [
  {
    id: 'welcome',
    target: '',
    title: 'Welcome to Monitrax!',
    description: 'Monitrax helps you see your entire wealth, forecast your future cashflow, and optimise your debt & investments. Let\'s take a quick tour of the main features.',
    placement: 'center',
  },
  {
    id: 'dashboard',
    target: '[data-tour="nav-dashboard"]',
    title: 'Dashboard',
    description: 'Your financial command center. See your total net worth, monthly cashflow, and key portfolio metrics at a glance.',
    placement: 'right',
  },
  {
    id: 'cfo',
    target: '[data-tour="nav-cfo"]',
    title: 'Personal CFO',
    description: 'Your AI-powered financial advisor. Ask questions about your finances, get insights, and receive personalised recommendations.',
    placement: 'right',
  },
  {
    id: 'portfolio',
    target: '[data-tour="nav-portfolio"]',
    title: 'Portfolio',
    description: 'Track all your assets here: Properties (with valuations & rental income), Loans (balances & interest rates), Bank Accounts, Investment Accounts, and Other Assets like vehicles.',
    placement: 'right',
  },
  {
    id: 'transactions',
    target: '[data-tour="nav-transactions"]',
    title: 'Transactions',
    description: 'Manage your money flow: Income sources (salary, rent, dividends), Expenses by category, All Transactions history, and Recurring payments.',
    placement: 'right',
  },
  {
    id: 'planning',
    target: '[data-tour="nav-planning"]',
    title: 'Planning',
    description: 'Plan your financial future: Cashflow forecasts, Financial Health score, AI Strategy recommendations, Debt Payoff Planner, and Tax Calculator.',
    placement: 'right',
  },
  {
    id: 'reporting',
    target: '[data-tour="nav-reporting"]',
    title: 'Reporting',
    description: 'Generate detailed reports and store important documents. Export data for your accountant or financial planner.',
    placement: 'right',
  },
  {
    id: 'settings',
    target: '[data-tour="nav-settings"]',
    title: 'Settings',
    description: 'Customise your experience: Update profile, preferences, and notifications.',
    placement: 'top',
  },
  {
    id: 'wrap-up',
    target: '',
    title: 'You\'re All Set!',
    description: 'Great! You now know your way around Monitrax. Next, complete the quick setup wizard to add your accounts and start tracking your wealth.',
    placement: 'center',
  },
];
