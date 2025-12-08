'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Sparkles,
  LayoutDashboard,
  PartyPopper,
  Brain,
  Briefcase,
  CreditCard,
  Lightbulb,
  BarChart3,
  Settings
} from 'lucide-react';
import { useGuidedTour, TourStep } from '@/hooks/useGuidedTour';
import { TourSpotlight } from './TourSpotlight';
import { TourTooltip } from './TourTooltip';
import '@/styles/tour-animations.css';

// Comprehensive Monitrax tour steps explaining each section
const monitraxTourSteps: TourStep[] = [
  {
    id: 'welcome',
    target: '',
    title: 'Welcome to Monitrax!',
    description: 'Monitrax helps you see your entire wealth, forecast your future cashflow, and optimise your debt & investments. Let\'s take a quick tour of the main features.',
    placement: 'center',
    icon: <Sparkles className="w-9 h-9 text-blue-500" />,
  },
  {
    id: 'dashboard',
    target: '[data-tour="nav-dashboard"]',
    title: 'Dashboard',
    description: 'Your financial command center. See your total net worth, monthly cashflow, and key portfolio metrics at a glance.',
    placement: 'right',
    icon: <LayoutDashboard className="w-6 h-6 text-blue-500" />,
  },
  {
    id: 'cfo',
    target: '[data-tour="nav-cfo"]',
    title: 'Personal CFO',
    description: 'Your AI-powered financial advisor. Ask questions about your finances, get insights, and receive personalised recommendations.',
    placement: 'right',
    icon: <Brain className="w-6 h-6 text-purple-500" />,
  },
  {
    id: 'portfolio',
    target: '[data-tour="nav-portfolio"]',
    title: 'Portfolio',
    description: 'Track all your assets here: Properties (with valuations & rental income), Loans (balances & interest rates), Bank Accounts, Investment Accounts, and Other Assets like vehicles.',
    placement: 'right',
    icon: <Briefcase className="w-6 h-6 text-emerald-500" />,
  },
  {
    id: 'transactions',
    target: '[data-tour="nav-transactions"]',
    title: 'Transactions',
    description: 'Manage your money flow: Income sources (salary, rent, dividends), Expenses by category, All Transactions history, and Recurring payments.',
    placement: 'right',
    icon: <CreditCard className="w-6 h-6 text-blue-500" />,
  },
  {
    id: 'planning',
    target: '[data-tour="nav-planning"]',
    title: 'Planning',
    description: 'Plan your financial future: Cashflow forecasts, Financial Health score, AI Strategy recommendations, Debt Payoff Planner, and Tax Calculator.',
    placement: 'right',
    icon: <Lightbulb className="w-6 h-6 text-amber-500" />,
  },
  {
    id: 'reporting',
    target: '[data-tour="nav-reporting"]',
    title: 'Reporting',
    description: 'Generate detailed reports and store important documents. Export data for your accountant or financial planner.',
    placement: 'right',
    icon: <BarChart3 className="w-6 h-6 text-indigo-500" />,
  },
  {
    id: 'settings',
    target: '[data-tour="nav-settings"]',
    title: 'Settings',
    description: 'Customise your experience: Update profile, preferences, and notifications.',
    placement: 'top',
    icon: <Settings className="w-6 h-6 text-gray-500" />,
  },
  {
    id: 'wrap-up',
    target: '',
    title: 'You\'re All Set!',
    description: 'Great! You now know your way around Monitrax. Next, complete the quick setup wizard to add your accounts and start tracking your wealth.',
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
