'use client';

import React from 'react';
import { Home, TrendingUp, Briefcase, Rocket, Check } from 'lucide-react';
import { OnboardingProfileType } from '@/hooks/useOnboardingState';
import { WizardData } from '../types';
import '@/styles/wizard-animations.css';

// =============================================================================
// PROFILE CARD DATA
// =============================================================================

interface ProfileOption {
  type: OnboardingProfileType;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgGradient: string;
  features: string[];
  estimatedTime: string;
}

const PROFILE_OPTIONS: ProfileOption[] = [
  {
    type: 'STARTER',
    title: 'Just Getting Started',
    description: 'Perfect for tracking basic finances and building wealth awareness',
    icon: <Rocket className="h-8 w-8" />,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgGradient: 'from-emerald-500/10 to-teal-500/10',
    features: [
      'Bank account tracking',
      'Income & expense monitoring',
      'Basic net worth calculation',
    ],
    estimatedTime: '~3 min',
  },
  {
    type: 'HOMEOWNER',
    title: 'Homeowner',
    description: 'For those with a home and mortgage to manage',
    icon: <Home className="h-8 w-8" />,
    color: 'text-blue-600 dark:text-blue-400',
    bgGradient: 'from-blue-500/10 to-indigo-500/10',
    features: [
      'Property & loan tracking',
      'Equity monitoring',
      'Offset account benefits',
      'Mortgage optimization insights',
    ],
    estimatedTime: '~5 min',
  },
  {
    type: 'INVESTOR',
    title: 'Property Investor',
    description: 'For investment property owners and share traders',
    icon: <TrendingUp className="h-8 w-8" />,
    color: 'text-purple-600 dark:text-purple-400',
    bgGradient: 'from-purple-500/10 to-pink-500/10',
    features: [
      'Multiple property management',
      'Rental income tracking',
      'Share portfolio monitoring',
      'Tax deduction optimization',
    ],
    estimatedTime: '~7 min',
  },
  {
    type: 'MIXED',
    title: 'Wealth Builder',
    description: 'Comprehensive tracking for diversified portfolios',
    icon: <Briefcase className="h-8 w-8" />,
    color: 'text-amber-600 dark:text-amber-400',
    bgGradient: 'from-amber-500/10 to-orange-500/10',
    features: [
      'All property & investment tools',
      'Personal asset tracking',
      'Complete financial picture',
      'Advanced strategy recommendations',
    ],
    estimatedTime: '~10 min',
  },
];

// =============================================================================
// COUNTRY & TAX YEAR OPTIONS
// =============================================================================

const COUNTRIES = [
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿' },
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'UK', name: 'United Kingdom', flag: '🇬🇧' },
];

const currentYear = new Date().getFullYear();
const TAX_YEARS = [
  `${currentYear - 1}-${currentYear}`,
  `${currentYear}-${currentYear + 1}`,
];

// =============================================================================
// WELCOME STEP COMPONENT
// =============================================================================

interface WelcomeStepProps {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
}

export function WelcomeStep({ data, onUpdate }: WelcomeStepProps) {
  const handleProfileSelect = (type: OnboardingProfileType) => {
    onUpdate({ profileType: type });
  };

  return (
    <div className="space-y-8 wizard-step-enter">
      {/* Welcome Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white text-3xl mb-4">
          👋
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Welcome to Monitrax
        </h2>
        <p className="text-gray-600 dark:text-gray-400 max-w-lg mx-auto">
          Let&apos;s set up your financial dashboard. First, tell us a bit about your situation
          so we can tailor the experience for you.
        </p>
      </div>

      {/* Profile Selection */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 text-center">
          What best describes you?
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PROFILE_OPTIONS.map((option, index) => (
            <button
              key={option.type}
              onClick={() => handleProfileSelect(option.type)}
              className={`profile-card relative p-6 rounded-xl border-2 text-left transition-all ${
                data.profileType === option.type
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 selected'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
              style={{ '--card-index': index } as React.CSSProperties}
            >
              {/* Selected Indicator */}
              {data.profileType === option.type && (
                <div className="absolute top-4 right-4 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                  <Check className="h-4 w-4 text-white" />
                </div>
              )}

              {/* Icon */}
              <div className={`mb-4 ${option.color}`}>
                <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${option.bgGradient}`}>
                  {option.icon}
                </div>
              </div>

              {/* Content */}
              <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                {option.title}
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {option.description}
              </p>

              {/* Features */}
              <ul className="space-y-1.5 mb-4">
                {option.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <div className={`w-1.5 h-1.5 rounded-full ${option.color.replace('text-', 'bg-').replace('-600', '-500')}`} />
                    {feature}
                  </li>
                ))}
              </ul>

              {/* Time Estimate */}
              <div className="text-xs text-gray-500 dark:text-gray-500">
                Setup time: {option.estimatedTime}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Country & Tax Year Selection */}
      {data.profileType && (
        <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700 wizard-card" style={{ '--card-index': 0 } as React.CSSProperties}>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 text-center">
            Location & Tax Settings
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md mx-auto">
            {/* Country Selection */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Country
              </label>
              <select
                value={data.country}
                onChange={(e) => onUpdate({ country: e.target.value })}
                className="wizard-input w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {COUNTRIES.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.flag} {country.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Tax Year Selection */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Tax Year
              </label>
              <select
                value={data.taxYear}
                onChange={(e) => onUpdate({ taxYear: e.target.value })}
                className="wizard-input w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {TAX_YEARS.map((year) => (
                  <option key={year} value={year}>
                    FY {year}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Helper Text */}
          <p className="text-xs text-center text-gray-500 dark:text-gray-500">
            This helps us tailor tax calculations and default settings for your region.
          </p>
        </div>
      )}

      {/* Ready Message */}
      {data.profileType && (
        <div className="text-center text-sm text-gray-500 dark:text-gray-400 wizard-card" style={{ '--card-index': 1 } as React.CSSProperties}>
          <p>
            Great choice! Click <strong>Continue</strong> to start adding your financial data.
          </p>
        </div>
      )}
    </div>
  );
}
