'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ArrowRight, ArrowLeft, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ease: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

interface Question {
  id: string;
  stage: string;
  stageLetter: string;
  question: string;
  options: { label: string; score: number }[];
}

const questions: Question[] = [
  {
    id: 'track',
    stage: 'Track',
    stageLetter: 'T',
    question: 'How well do you know your financial picture?',
    options: [
      { label: 'I know exactly where every dollar goes', score: 3 },
      { label: 'I have a rough idea', score: 2 },
      { label: 'Honestly, I avoid looking', score: 0 },
    ],
  },
  {
    id: 'reduce',
    stage: 'Reduce',
    stageLetter: 'R',
    question: 'At the end of each month, do you have money left over?',
    options: [
      { label: 'Yes, I consistently save', score: 3 },
      { label: 'Sometimes, depends on the month', score: 2 },
      { label: 'I usually run out or go into debt', score: 0 },
    ],
  },
  {
    id: 'anchor',
    stage: 'Anchor',
    stageLetter: 'A',
    question: 'If your car broke down ($3,000), could you cover it without borrowing?',
    options: [
      { label: 'Yes, easily', score: 3 },
      { label: "I'd manage but it would be tight", score: 2 },
      { label: "I'd need to borrow or use credit", score: 0 },
    ],
  },
  {
    id: 'invest',
    stage: 'Invest',
    stageLetter: 'I',
    question: 'Are you actively growing your wealth? (Property, shares, super top-ups)',
    options: [
      { label: 'Yes, I invest regularly', score: 3 },
      { label: "I've started but inconsistently", score: 2 },
      { label: "Not yet — I don't know where to start", score: 0 },
    ],
  },
  {
    id: 'live',
    stage: 'Live',
    stageLetter: 'L',
    question: 'How would you describe your relationship with money?',
    options: [
      { label: 'Confident and in control', score: 3 },
      { label: 'Getting there but still stressed sometimes', score: 2 },
      { label: 'Overwhelmed — money stresses me out', score: 0 },
    ],
  },
];

interface StageResult {
  letter: string;
  name: string;
  tagline: string;
  description: string;
  tips: string[];
  color: string;
}

const stageResults: Record<string, StageResult> = {
  T: {
    letter: 'T',
    name: 'Track',
    tagline: "Let's start by seeing your full picture",
    description:
      "You're at the beginning of the TRAIL. The first step is the most important — and the bravest. Most people avoid looking at their finances because they're afraid of what they'll find. But the unknown is always scarier than the known.",
    tips: [
      'Connect all your bank accounts into one place — seeing everything together changes everything',
      'Calculate your net worth: what you own minus what you owe. Just knowing the number is a breakthrough.',
      'Track your spending for one month — no judgment, just awareness. Where is the money actually going?',
    ],
    color: 'amber',
  },
  R: {
    letter: 'R',
    name: 'Reduce',
    tagline: 'Time to fix the leaks',
    description:
      "You can see your finances — that's a great start. But you're spending more than you should, and debt may be weighing you down. The good news? This is the stage where small changes make the biggest difference.",
    tips: [
      'Review your subscriptions — the average Australian has $340/month in forgotten recurring charges',
      'Start a debt paydown plan: list your debts smallest to largest, attack the smallest first for quick wins',
      'Set up a simple budget: income minus essentials = what you have left. No spreadsheet needed.',
    ],
    color: 'orange',
  },
  A: {
    letter: 'A',
    name: 'Anchor',
    tagline: 'Build your safety net',
    description:
      "You're in control of your spending and your debt is manageable. Now it's time to build the safety net that keeps you stable when life throws surprises. One unexpected bill shouldn't undo months of progress.",
    tips: [
      'Build an emergency fund — start with $2,000, then grow to 3 months of expenses',
      'Keep your emergency fund in a separate bank account — out of sight, out of mind',
      'Make sure all bills are on automatic payment — no late fees, no stress, no surprises',
    ],
    color: 'emerald',
  },
  I: {
    letter: 'I',
    name: 'Invest',
    tagline: "You're ready to grow",
    description:
      "Your foundation is solid — safety net built, spending under control. Now compound growth starts working for you. This is where wealth is actually built, not through lottery tickets, but through consistent, patient investing.",
    tips: [
      'Check your super — are you at 15%? Salary sacrificing even $100/month can save thousands in tax',
      'Consider a diversified index fund if you haven\'t started investing — start small, stay consistent',
      'Track your net worth quarterly — watching it grow is the most powerful motivator there is',
    ],
    color: 'sky',
  },
  L: {
    letter: 'L',
    name: 'Live',
    tagline: "You're living on your terms",
    description:
      "You've built the system. Your money works for you. You make financial decisions from abundance, not stress. Now it's about optimising, giving, and enjoying the freedom you've earned.",
    tips: [
      'Calculate your financial independence number — when passive income covers expenses, work becomes optional',
      'Consider estate planning — protect what you\'ve built for the people you love',
      'Review and optimise your tax position — at this stage, smart tax planning can save thousands annually',
    ],
    color: 'yellow',
  },
};

function getStage(total: number): string {
  if (total <= 3) return 'T';
  if (total <= 6) return 'R';
  if (total <= 9) return 'A';
  if (total <= 12) return 'I';
  return 'L';
}

const allStages = ['T', 'R', 'A', 'I', 'L'];

export default function TrailCheckPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [showResults, setShowResults] = useState(false);
  const reduced = useReducedMotion();

  const totalScore = Object.values(answers).reduce((sum, s) => sum + s, 0);
  const stage = getStage(totalScore);
  const result = stageResults[stage];
  const stageIndex = allStages.indexOf(stage);
  const progress = ((currentStep + 1) / questions.length) * 100;

  function selectAnswer(questionId: string, score: number) {
    setAnswers((prev) => ({ ...prev, [questionId]: score }));
    if (currentStep < questions.length - 1) {
      setTimeout(() => setCurrentStep((s) => s + 1), 300);
    } else {
      setTimeout(() => {
        try {
          localStorage.setItem(
            'monitrax_trail_check',
            JSON.stringify({ stage, totalScore, answers, completedAt: new Date().toISOString() })
          );
        } catch {}
        setShowResults(true);
      }, 300);
    }
  }

  if (showResults && result) {
    return (
      <div className="min-h-screen bg-stone-950 flex flex-col">
        {/* Header */}
        <header className="border-b border-white/[0.06] px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-b from-amber-500 to-amber-600 shadow-sm">
              <span className="text-lg font-bold text-white">M</span>
            </div>
            <span className="text-xl font-bold text-white tracking-tight">Monitrax</span>
          </Link>
        </header>

        <main className="flex-1 flex items-center justify-center px-6 py-12">
          <motion.div
            initial={reduced ? {} : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease }}
            className="w-full max-w-2xl"
          >
            {/* Stage badge */}
            <div className="text-center mb-8">
              <p className="text-sm font-semibold uppercase tracking-widest text-amber-500 mb-3">
                Your TRAIL Stage
              </p>
              <h1
                className="text-4xl font-bold text-white sm:text-5xl"
                style={{ letterSpacing: '-0.02em' }}
              >
                {result.name}
              </h1>
              <p className="mt-2 text-lg text-stone-400">{result.tagline}</p>
            </div>

            {/* TRAIL progress indicator */}
            <div className="flex items-center justify-center gap-1.5 mb-10">
              {allStages.map((s, i) => (
                <div key={s} className="flex items-center">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                      i <= stageIndex
                        ? 'bg-amber-500 text-white'
                        : 'bg-stone-800 text-stone-500'
                    }`}
                  >
                    {i < stageIndex ? (
                      <CheckCircle className="h-5 w-5" />
                    ) : (
                      s
                    )}
                  </div>
                  {i < allStages.length - 1 && (
                    <div
                      className={`w-8 sm:w-12 h-0.5 ${
                        i < stageIndex ? 'bg-amber-500' : 'bg-stone-800'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Description */}
            <div className="rounded-2xl border border-stone-800 bg-stone-900/50 p-6 sm:p-8 mb-8">
              <p className="text-stone-300" style={{ lineHeight: 1.7 }}>
                {result.description}
              </p>
            </div>

            {/* Tips */}
            <div className="rounded-2xl border border-stone-800 bg-stone-900/50 p-6 sm:p-8 mb-8">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-amber-500 mb-4">
                3 things to focus on
              </h2>
              <div className="space-y-4">
                {result.tips.map((tip, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-xs font-bold text-amber-500">
                      {i + 1}
                    </span>
                    <p className="text-stone-300 text-sm" style={{ lineHeight: 1.6 }}>
                      {tip}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div className="text-center">
              <p className="text-stone-400 mb-4">
                Want a personal Guide to walk you through this?
              </p>
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-b from-amber-500 to-amber-600 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-amber-600/25 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-amber-600/30"
              >
                Start your TRAIL — it&apos;s free
              </Link>
              <p className="mt-3 text-sm text-stone-500">
                No credit card. Takes 3 minutes to set up.
              </p>
            </div>
          </motion.div>
        </main>
      </div>
    );
  }

  const q = questions[currentStep];

  return (
    <div className="min-h-screen bg-stone-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-white/[0.06] px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-b from-amber-500 to-amber-600 shadow-sm">
            <span className="text-lg font-bold text-white">M</span>
          </div>
          <span className="text-xl font-bold text-white tracking-tight">Monitrax</span>
        </Link>
        <span className="text-sm text-stone-500">
          {currentStep + 1} of {questions.length}
        </span>
      </header>

      {/* Progress bar */}
      <div className="h-1 bg-stone-800">
        <motion.div
          className="h-full bg-gradient-to-r from-amber-500 to-amber-600"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3, ease }}
        />
      </div>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={reduced ? {} : { opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduced ? {} : { opacity: 0, x: -30 }}
              transition={{ duration: 0.3, ease }}
            >
              {/* Stage indicator */}
              <div className="mb-6">
                <span className="inline-flex items-center gap-2 rounded-full bg-stone-800 px-3 py-1 text-xs font-semibold text-stone-400">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-amber-500 text-[10px] font-bold">
                    {q.stageLetter}
                  </span>
                  {q.stage}
                </span>
              </div>

              {/* Question */}
              <h2
                className="text-2xl font-bold text-white sm:text-3xl mb-8"
                style={{ letterSpacing: '-0.02em', lineHeight: 1.2 }}
              >
                {q.question}
              </h2>

              {/* Options */}
              <div className="space-y-3">
                {q.options.map((option) => {
                  const isSelected = answers[q.id] === option.score;
                  return (
                    <button
                      key={option.label}
                      onClick={() => selectAnswer(q.id, option.score)}
                      className={`w-full text-left rounded-xl border px-5 py-4 text-sm font-medium transition-all duration-200 ${
                        isSelected
                          ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                          : 'border-stone-700 bg-stone-900/50 text-stone-300 hover:border-stone-600 hover:bg-stone-800/50'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>

              {/* Back button */}
              {currentStep > 0 && (
                <button
                  onClick={() => setCurrentStep((s) => s - 1)}
                  className="mt-6 flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-300 transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </button>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
