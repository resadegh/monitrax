'use client';

import React from 'react';
import { Sparkles, X } from 'lucide-react';

interface OnboardingProgressBadgeProps {
  isVisible: boolean;
  currentStep: number;
  totalSteps: number;
  onResume: () => void;
  onDismiss: () => void;
}

export function OnboardingProgressBadge({
  isVisible,
  currentStep,
  totalSteps,
  onResume,
  onDismiss,
}: OnboardingProgressBadgeProps) {
  if (!isVisible) return null;

  const progress = Math.round((currentStep / totalSteps) * 100);

  return (
    <div className="relative flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-sm">
      {/* Icon */}
      <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
        <Sparkles className="w-4 h-4 text-blue-600" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-blue-900">Setup in progress</span>
          <span className="text-blue-600 text-xs">
            {currentStep}/{totalSteps} steps
          </span>
        </div>

        {/* Progress bar */}
        <div className="mt-1 h-1.5 bg-blue-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Resume button */}
      <button
        onClick={onResume}
        className="flex-shrink-0 text-blue-600 hover:text-blue-700 font-medium text-sm hover:underline"
      >
        Resume
      </button>

      {/* Dismiss button */}
      <button
        onClick={onDismiss}
        className="flex-shrink-0 p-1 hover:bg-blue-100 rounded transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4 text-blue-400 hover:text-blue-600" />
      </button>
    </div>
  );
}
