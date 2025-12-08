'use client';

import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import '@/styles/tour-animations.css';

interface TourTooltipProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  currentStep: number;
  totalSteps: number;
  placement: 'top' | 'bottom' | 'left' | 'right' | 'center';
  targetPosition: {
    top: number;
    left: number;
    width: number;
    height: number;
  } | null;
  isFirstStep: boolean;
  isLastStep: boolean;
  isAnimating: boolean;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onGoToStep: (index: number) => void;
}

export function TourTooltip({
  title,
  description,
  icon,
  currentStep,
  totalSteps,
  placement,
  targetPosition,
  isFirstStep,
  isLastStep,
  isAnimating,
  onNext,
  onPrev,
  onSkip,
  onGoToStep,
}: TourTooltipProps) {
  // Calculate tooltip position based on target and placement
  const tooltipStyle = useMemo(() => {
    if (placement === 'center' || !targetPosition) {
      return {}; // Center modal handles its own positioning
    }

    const gap = 16; // Gap between tooltip and target
    const style: React.CSSProperties = {};
    const tooltipWidth = 360; // Approximate tooltip width
    const tooltipHeight = 200; // Approximate tooltip height

    switch (placement) {
      case 'right':
        style.top = Math.max(gap, Math.min(targetPosition.top, window.innerHeight - tooltipHeight - gap));
        style.left = targetPosition.left + targetPosition.width + gap;
        break;
      case 'left':
        style.top = Math.max(gap, Math.min(targetPosition.top, window.innerHeight - tooltipHeight - gap));
        style.right = window.innerWidth - targetPosition.left + gap;
        break;
      case 'bottom':
        style.top = targetPosition.top + targetPosition.height + gap;
        style.left = Math.max(gap, Math.min(targetPosition.left, window.innerWidth - tooltipWidth - gap));
        break;
      case 'top':
        // Position above the target, but to the right of sidebar for visibility
        style.bottom = window.innerHeight - targetPosition.top + gap;
        style.left = targetPosition.left + targetPosition.width + gap;
        // Keep within viewport
        if (style.left + tooltipWidth > window.innerWidth) {
          style.left = window.innerWidth - tooltipWidth - gap;
        }
        break;
    }

    return style;
  }, [placement, targetPosition]);

  // Render center modal for welcome/wrap-up steps
  if (placement === 'center') {
    return (
      <div className={`tour-center-modal ${isAnimating ? 'fading-out' : ''}`}>
        <div className="tour-center-content">
          {icon && <div className="tour-center-icon">{icon}</div>}
          <h2 className="tour-center-title">{title}</h2>
          <p className="tour-center-description">{description}</p>
          <div className="tour-center-actions">
            <button
              className="tour-center-btn primary"
              onClick={onNext}
            >
              {isLastStep ? 'Start Setup Wizard' : "Let's Go!"}
              <ChevronRight className="w-5 h-5" />
            </button>
            <button
              className="tour-center-btn secondary"
              onClick={onSkip}
            >
              {isFirstStep ? 'Skip for now' : 'Close tour'}
            </button>
          </div>
        </div>

        {/* Progress dots for center modals */}
        <div className="tour-progress-dots" style={{ borderTop: '1px solid #e5e7eb', borderBottom: 'none' }}>
          {Array.from({ length: totalSteps }).map((_, index) => (
            <button
              key={index}
              className={`tour-progress-dot ${
                index === currentStep ? 'active' : index < currentStep ? 'completed' : ''
              }`}
              onClick={() => onGoToStep(index)}
              aria-label={`Go to step ${index + 1}`}
            />
          ))}
        </div>
      </div>
    );
  }

  // Regular tooltip for non-center placements
  return (
    <div
      className={`tour-tooltip placement-${placement} ${isAnimating ? 'fading-out' : ''}`}
      style={tooltipStyle}
    >
      {/* Progress dots */}
      <div className="tour-progress-dots">
        {Array.from({ length: totalSteps }).map((_, index) => (
          <button
            key={index}
            className={`tour-progress-dot ${
              index === currentStep ? 'active' : index < currentStep ? 'completed' : ''
            }`}
            onClick={() => onGoToStep(index)}
            aria-label={`Go to step ${index + 1}`}
          />
        ))}
      </div>

      {/* Content */}
      <div className="tour-tooltip-content">
        {icon && <div className="tour-tooltip-icon">{icon}</div>}
        <h3 className="tour-tooltip-title">{title}</h3>
        <p className="tour-tooltip-description">{description}</p>
      </div>

      {/* Actions */}
      <div className="tour-tooltip-actions">
        <button className="tour-tooltip-skip" onClick={onSkip}>
          Skip
        </button>
        <div className="tour-tooltip-nav">
          {!isFirstStep && (
            <button className="tour-tooltip-btn secondary" onClick={onPrev}>
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          )}
          <button className="tour-tooltip-btn primary" onClick={onNext}>
            {isLastStep ? 'Finish' : 'Next'}
            <ChevronRight className="w-4 h-4" />
            <span className="tour-step-counter">
              ({currentStep + 1}/{totalSteps})
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
