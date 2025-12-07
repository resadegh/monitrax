'use client';

import React from 'react';
import { Home, TrendingUp, Building2, Sparkles } from 'lucide-react';
import type { OnboardingProfileType } from '@/hooks/useOnboardingState';

interface ProfileTypeStepProps {
  value: OnboardingProfileType | null;
  onChange: (type: OnboardingProfileType) => void;
}

const profileOptions: Array<{
  type: OnboardingProfileType;
  icon: React.ReactNode;
  title: string;
  description: string;
}> = [
  {
    type: 'HOMEOWNER',
    icon: <Home className="w-6 h-6" />,
    title: 'Homeowner with mortgage',
    description: 'I have a home with a mortgage and want to track my equity',
  },
  {
    type: 'INVESTOR',
    icon: <Building2 className="w-6 h-6" />,
    title: 'Property investor',
    description: 'I have investment properties and want to manage my portfolio',
  },
  {
    type: 'MIXED',
    icon: <TrendingUp className="w-6 h-6" />,
    title: 'Shares & investments',
    description: 'I primarily invest in shares, ETFs, or managed funds',
  },
  {
    type: 'STARTER',
    icon: <Sparkles className="w-6 h-6" />,
    title: 'Just getting started',
    description: 'I\'m new to investing and want to track my finances',
  },
];

export function ProfileTypeStep({ value, onChange }: ProfileTypeStepProps) {
  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-lg font-medium text-gray-900">
          What best describes your situation?
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          This helps us prioritize what to set up first
        </p>
      </div>

      <div className="grid gap-3">
        {profileOptions.map((option) => (
          <button
            key={option.type}
            onClick={() => onChange(option.type)}
            className={`flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all ${
              value === option.type
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <div
              className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${
                value === option.type
                  ? 'bg-blue-100 text-blue-600'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {option.icon}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-gray-900">{option.title}</h4>
              <p className="text-sm text-gray-500 mt-0.5">{option.description}</p>
            </div>
            {value === option.type && (
              <div className="flex-shrink-0 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
