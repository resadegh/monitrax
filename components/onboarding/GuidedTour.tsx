'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, LayoutDashboard, Home, CreditCard, TrendingUp, Receipt, Brain, PartyPopper } from 'lucide-react';
import { useGuidedTour, TourStep } from '@/hooks/useGuidedTour';
import { TourSpotlight } from './TourSpotlight';
import { TourTooltip } from './TourTooltip';
import '@/styles/tour-animations.css';

// Default Monitrax tour steps with icons
const monitraxTourSteps: TourStep[] = [
  {
    id: 'welcome',
    target: '',
    title: 'Welcome to Monitrax!',
    description: 'Monitrax helps you see your entire wealth, forecast your future cashflow, and optimise your debt & investments. Let\'s take a quick tour of the app.',
    placement: 'center',
    icon: <Sparkles className="w-9 h-9 text-blue-500" />,
  },
  {
    id: 'sidebar',
    target: '[data-tour="sidebar"]',
    title: 'Navigation Sidebar',
    description: 'Here are your main sections: Dashboard, Properties, Loans, Investments, Income & Expenses, Tax & Strategy. Click any item to explore.',
    placement: 'right',
    spotlightPadding: 0,
    icon: <LayoutDashboard className="w-6 h-6 text-blue-500" />,
  },
  {
    id: 'dashboard',
    target: '[data-tour="dashboard-stats"]',
    title: 'Dashboard Overview',
    description: 'Your dashboard shows your net worth, cashflow, and key portfolio metrics at a glance. This is your financial command center.',
    placement: 'bottom',
    icon: <LayoutDashboard className="w-6 h-6 text-blue-500" />,
  },
  {
    id: 'properties',
    target: '[data-tour="nav-properties"]',
    title: 'Properties',
    description: 'Track each property\'s value, loans, rental income, expenses and depreciation. Perfect for property investors.',
    placement: 'right',
    icon: <Home className="w-6 h-6 text-blue-500" />,
  },
  {
    id: 'loans',
    target: '[data-tour="nav-loans"]',
    title: 'Loans',
    description: 'See your loan balances, interest rates, offset accounts and repayment details. Optimise your debt strategy here.',
    placement: 'right',
    icon: <CreditCard className="w-6 h-6 text-blue-500" />,
  },
  {
    id: 'investments',
    target: '[data-tour="nav-investments"]',
    title: 'Investments',
    description: 'Monitor investment accounts, holdings and transactions. Track dividends and link them to your income.',
    placement: 'right',
    icon: <TrendingUp className="w-6 h-6 text-blue-500" />,
  },
  {
    id: 'income-expenses',
    target: '[data-tour="nav-transactions"]',
    title: 'Income & Expenses',
    description: 'Categorise your inflows and outflows. This powers your cashflow forecasts and strategy recommendations.',
    placement: 'right',
    icon: <Receipt className="w-6 h-6 text-blue-500" />,
  },
  {
    id: 'strategy',
    target: '[data-tour="nav-strategy"]',
    title: 'Strategy Engine',
    description: 'Use our AI-powered Strategy Engine to explore scenarios and get personalised optimisation recommendations.',
    placement: 'right',
    icon: <Brain className="w-6 h-6 text-blue-500" />,
  },
  {
    id: 'wrap-up',
    target: '',
    title: 'You\'re Ready to Go!',
    description: 'Excellent! You now know your way around Monitrax. Next, we recommend completing the quick setup wizard so we can calculate your net worth and forecasts.',
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

  // Don't render if not open or no current step
  if (!isOpen || !currentStep) return null;

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
