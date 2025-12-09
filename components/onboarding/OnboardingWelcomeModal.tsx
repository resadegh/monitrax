'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, ArrowRight, Play, X, TrendingUp, PiggyBank, BarChart3 } from 'lucide-react';

interface OnboardingWelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartSetup: () => void;
  onTakeTour: () => void;
  onSkip: () => void;
  onDismissPermanently?: () => void;
}

export function OnboardingWelcomeModal({
  isOpen,
  onClose,
  onStartSetup,
  onTakeTour,
  onSkip,
  onDismissPermanently,
}: OnboardingWelcomeModalProps) {
  // Handle SSR - only render portal after mounting on client
  const [mounted, setMounted] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSkip = () => {
    if (dontShowAgain && onDismissPermanently) {
      onDismissPermanently();
    }
    onSkip();
  };

  if (!mounted || !isOpen) return null;

  const valueProps = [
    {
      icon: <TrendingUp className="w-5 h-5" />,
      title: 'Know your net worth',
      description: 'See your complete financial picture in one place',
    },
    {
      icon: <BarChart3 className="w-5 h-5" />,
      title: 'Forecast your cashflow',
      description: 'Plan ahead with smart predictions',
    },
    {
      icon: <PiggyBank className="w-5 h-5" />,
      title: 'Optimise your strategy',
      description: 'Get AI-powered recommendations',
    },
  ];

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleSkip}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        {/* Close button */}
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition-colors z-10"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>

        {/* Header */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 px-8 pt-10 pb-8 text-white">
          <div className="flex items-center justify-center w-16 h-16 bg-white/20 rounded-2xl mb-6 mx-auto backdrop-blur-sm">
            <Sparkles className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-center mb-2">
            Welcome to Monitrax!
          </h1>
          <p className="text-blue-100 text-center">
            Let&apos;s get you set up in just a few minutes
          </p>
        </div>

        {/* Value props */}
        <div className="px-8 py-6 space-y-4">
          {valueProps.map((prop, index) => (
            <div key={index} className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                {prop.icon}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{prop.title}</h3>
                <p className="text-sm text-gray-600">{prop.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="px-8 pb-8 space-y-3">
          <button
            onClick={onStartSetup}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 px-6 rounded-xl transition-colors"
          >
            Start guided setup
            <ArrowRight className="w-5 h-5" />
          </button>

          <button
            onClick={onTakeTour}
            className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3.5 px-6 rounded-xl transition-colors"
          >
            <Play className="w-5 h-5" />
            Take a quick tour first
          </button>

          <button
            onClick={handleSkip}
            className="w-full text-sm text-gray-500 hover:text-gray-700 py-2 transition-colors"
          >
            Skip for now — I&apos;ll explore on my own
          </button>

          {/* Don't show again checkbox */}
          <label className="flex items-center justify-center gap-2 pt-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs text-gray-400 group-hover:text-gray-600 transition-colors">
              Don&apos;t show this again
            </span>
          </label>
        </div>
      </div>
    </div>,
    document.body
  );
}
