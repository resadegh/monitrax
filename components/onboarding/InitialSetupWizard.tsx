'use client';

/**
 * @deprecated This wizard component is deprecated and no longer used.
 * Please use WizardContainer from './wizard/WizardContainer' instead.
 *
 * The new v2.0 wizard system offers:
 * - Profile-aware step configuration
 * - Enhanced AI assistance
 * - Better type safety with centralized types
 * - Support for multiple items per category
 *
 * This file and its associated /steps/ directory are kept for reference
 * but should not be used in new code.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, Check, Loader2 } from 'lucide-react';
import { useOnboardingState, OnboardingProfileType } from '@/hooks/useOnboardingState';

// Step components
import { ProfileTypeStep } from './steps/ProfileTypeStep';
import { CountryTaxStep } from './steps/CountryTaxStep';
import { BankAccountStep } from './steps/BankAccountStep';
import { PropertyStep } from './steps/PropertyStep';
import { InvestmentAccountStep } from './steps/InvestmentAccountStep';
import { IncomeStep } from './steps/IncomeStep';
import { ExpenseStep } from './steps/ExpenseStep';
import { ReviewStep } from './steps/ReviewStep';

interface WizardStepConfig {
  id: string;
  title: string;
  description: string;
  isOptional?: boolean;
}

const wizardSteps: WizardStepConfig[] = [
  {
    id: 'profile',
    title: 'Your Profile',
    description: 'Tell us about your financial situation',
  },
  {
    id: 'country',
    title: 'Location & Tax',
    description: 'Confirm your country and tax year',
  },
  {
    id: 'account',
    title: 'Cash Account',
    description: 'Add your main bank or cash account',
  },
  {
    id: 'property',
    title: 'Property',
    description: 'Add your primary residence or investment property',
    isOptional: true,
  },
  {
    id: 'investment',
    title: 'Investments',
    description: 'Add an investment account',
    isOptional: true,
  },
  {
    id: 'income',
    title: 'Income',
    description: 'Add your primary income source',
  },
  {
    id: 'expense',
    title: 'Expenses',
    description: 'Set up your baseline expenses',
  },
  {
    id: 'review',
    title: 'Review',
    description: 'Review and finish setup',
  },
];

interface InitialSetupWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  initialStep?: number;
}

interface WizardData {
  profileType: OnboardingProfileType | null;
  country: string;
  taxYear: string;
  account: {
    name: string;
    type: string;
    balance: number;
  } | null;
  property: {
    name: string;
    type: string;
    value: number;
    hasLoan: boolean;
    loanDetails?: {
      lender: string;
      principal: number;
      rate: number;
      isFixed: boolean;
      isInterestOnly: boolean;
    };
  } | null;
  investmentAccount: {
    name: string;
    type: string;
    value: number;
  } | null;
  income: {
    name: string;
    type: string;
    amount: number;
    frequency: string;
  } | null;
  expenses: {
    living: number;
    transport: number;
    groceries: number;
    discretionary: number;
  } | null;
}

export function InitialSetupWizard({
  isOpen,
  onClose,
  onComplete,
  initialStep = 0,
}: InitialSetupWizardProps) {
  // Handle SSR - only render portal after mounting on client
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [currentStep, setCurrentStep] = useState(initialStep);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [wizardData, setWizardData] = useState<WizardData>({
    profileType: null,
    country: 'AU',
    taxYear: getCurrentTaxYear(),
    account: null,
    property: null,
    investmentAccount: null,
    income: null,
    expenses: null,
  });

  const { setCurrentStep: saveStep, completeOnboarding } = useOnboardingState();

  const currentStepConfig = wizardSteps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === wizardSteps.length - 1;
  const progress = ((currentStep + 1) / wizardSteps.length) * 100;

  const updateData = useCallback(<K extends keyof WizardData>(
    key: K,
    value: WizardData[K]
  ) => {
    setWizardData(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleNext = useCallback(async () => {
    if (isLastStep) {
      // Complete the wizard
      setIsSubmitting(true);
      try {
        await submitWizardData(wizardData);
        await completeOnboarding();
        onComplete();
      } catch (error) {
        console.error('Failed to complete wizard:', error);
      } finally {
        setIsSubmitting(false);
      }
    } else {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      saveStep(nextStep);
    }
  }, [currentStep, isLastStep, wizardData, completeOnboarding, onComplete, saveStep]);

  const handleBack = useCallback(() => {
    if (!isFirstStep) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      saveStep(prevStep);
    }
  }, [currentStep, isFirstStep, saveStep]);

  const handleSkip = useCallback(() => {
    if (currentStepConfig?.isOptional) {
      handleNext();
    }
  }, [currentStepConfig, handleNext]);

  // Don't render if not mounted (SSR) or not open
  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {currentStepConfig?.title}
            </h2>
            <p className="text-sm text-gray-500">
              {currentStepConfig?.description}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
            <span>Step {currentStep + 1} of {wizardSteps.length}</span>
            <span>{Math.round(progress)}% complete</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {currentStep === 0 && (
            <ProfileTypeStep
              value={wizardData.profileType}
              onChange={(type) => updateData('profileType', type)}
            />
          )}
          {currentStep === 1 && (
            <CountryTaxStep
              country={wizardData.country}
              taxYear={wizardData.taxYear}
              onChangeCountry={(c) => updateData('country', c)}
              onChangeTaxYear={(y) => updateData('taxYear', y)}
            />
          )}
          {currentStep === 2 && (
            <BankAccountStep
              value={wizardData.account}
              onChange={(a) => updateData('account', a)}
            />
          )}
          {currentStep === 3 && (
            <PropertyStep
              value={wizardData.property}
              onChange={(p) => updateData('property', p)}
            />
          )}
          {currentStep === 4 && (
            <InvestmentAccountStep
              value={wizardData.investmentAccount}
              onChange={(i) => updateData('investmentAccount', i)}
            />
          )}
          {currentStep === 5 && (
            <IncomeStep
              value={wizardData.income}
              onChange={(i) => updateData('income', i)}
            />
          )}
          {currentStep === 6 && (
            <ExpenseStep
              value={wizardData.expenses}
              incomeAmount={wizardData.income?.amount}
              onChange={(e) => updateData('expenses', e)}
            />
          )}
          {currentStep === 7 && (
            <ReviewStep data={wizardData} />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div>
            {!isFirstStep && (
              <button
                onClick={handleBack}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {currentStepConfig?.isOptional && (
              <button
                onClick={handleSkip}
                className="px-4 py-2 text-gray-500 hover:text-gray-700 transition-colors"
              >
                Skip for now
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : isLastStep ? (
                <>
                  <Check className="w-4 h-4" />
                  Finish Setup
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Helper function to get current Australian tax year
function getCurrentTaxYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  // Australian FY runs July 1 to June 30
  // If we're in July-December, we're in FY{year}-{year+1}
  // If we're in January-June, we're in FY{year-1}-{year}
  if (month >= 6) {
    return `${year}-${(year + 1).toString().slice(-2)}`;
  }
  return `${year - 1}-${year.toString().slice(-2)}`;
}

// Submit wizard data to create entities
async function submitWizardData(data: WizardData): Promise<void> {
  // Create account if provided
  if (data.account) {
    await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.account.name,
        type: data.account.type,
        currentBalance: data.account.balance,
      }),
    });
  }

  // Create property if provided
  if (data.property) {
    const propertyRes = await fetch('/api/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.property.name,
        type: data.property.type,
        purchasePrice: data.property.value,
        currentValue: data.property.value,
        purchaseDate: new Date().toISOString(),
        valuationDate: new Date().toISOString(),
      }),
    });

    // Create loan if property has one
    if (data.property.hasLoan && data.property.loanDetails) {
      const property = await propertyRes.json();
      await fetch('/api/loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.property.loanDetails.lender,
          type: data.property.type === 'HOME' ? 'HOME' : 'INVESTMENT',
          principal: data.property.loanDetails.principal,
          interestRateAnnual: data.property.loanDetails.rate / 100,
          rateType: data.property.loanDetails.isFixed ? 'FIXED' : 'VARIABLE',
          isInterestOnly: data.property.loanDetails.isInterestOnly,
          termMonthsRemaining: 360, // 30 years default
          minRepayment: 0, // Will be calculated
          repaymentFrequency: 'MONTHLY',
          propertyId: property.id,
        }),
      });
    }
  }

  // Create investment account if provided
  if (data.investmentAccount) {
    await fetch('/api/investments/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.investmentAccount.name,
        type: data.investmentAccount.type,
        cashBalance: data.investmentAccount.value,
      }),
    });
  }

  // Create income if provided
  if (data.income) {
    await fetch('/api/income', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.income.name,
        type: data.income.type,
        amount: data.income.amount,
        frequency: data.income.frequency,
      }),
    });
  }

  // Create expenses if provided
  if (data.expenses) {
    const expenseCategories = [
      { name: 'Living expenses', category: 'HOUSING', amount: data.expenses.living },
      { name: 'Transport', category: 'TRANSPORT', amount: data.expenses.transport },
      { name: 'Groceries', category: 'FOOD', amount: data.expenses.groceries },
      { name: 'Discretionary', category: 'ENTERTAINMENT', amount: data.expenses.discretionary },
    ];

    for (const exp of expenseCategories) {
      if (exp.amount > 0) {
        await fetch('/api/expenses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: exp.name,
            category: exp.category,
            amount: exp.amount,
            frequency: 'MONTHLY',
          }),
        });
      }
    }
  }
}
