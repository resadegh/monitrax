'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MessageCircle, X, Send, Loader2, Sparkles, ChevronDown } from 'lucide-react';
import { WizardStepId } from './types';
import '@/styles/wizard-animations.css';

// =============================================================================
// CONTEXT-AWARE PROMPTS FOR EACH STEP
// =============================================================================

const STEP_CONTEXT: Record<WizardStepId, {
  title: string;
  description: string;
  suggestions: string[];
}> = {
  welcome: {
    title: 'Getting Started',
    description: 'I can help you choose the right profile type for your situation.',
    suggestions: [
      'Which profile type should I choose?',
      'What\'s the difference between Homeowner and Investor?',
      'Can I change my profile type later?',
    ],
  },
  household: {
    title: 'Household Setup',
    description: 'I can help you set up your household members and pets for personalized tracking.',
    suggestions: [
      'Why should I add household members?',
      'What categories are created for income earners?',
      'Do I need to add my pets?',
    ],
  },
  entities: {
    title: 'How is your wealth held?',
    description: 'I can help you decide whether to add a family trust, SMSF, or company — or stick with just your personal name.',
    suggestions: [
      "I'm new to investing — do I need a trust?",
      'When does an SMSF make sense?',
      'What does "trustee company" mean?',
      "Can I add a structure later if I don't have one yet?",
    ],
  },
  properties: {
    title: 'Properties & Loans',
    description: 'I can help you understand property values, loan terms, and what to include.',
    suggestions: [
      'How do I find my property\'s current value?',
      'What\'s the difference between fixed and variable rates?',
      'Should I include my PPOR or just investment properties?',
      'What property expenses should I track?',
    ],
  },
  debts: {
    title: 'Debts & Loans',
    description: 'I can help you capture non-property debts — car loans, HECS, personal and business loans.',
    suggestions: [
      'How does HECS indexation work?',
      'Should I link my car loan to a vehicle?',
      'Do I include buy-now-pay-later balances?',
      'What\'s the difference between a personal loan and a credit card here?',
    ],
  },
  accounts: {
    title: 'Bank Accounts',
    description: 'I can explain account types and offset account benefits.',
    suggestions: [
      'What is an offset account and how does it work?',
      'Should I include all my bank accounts?',
      'What\'s the benefit of linking offset accounts?',
    ],
  },
  investments: {
    title: 'Investment Accounts',
    description: 'I can help you understand how to track your investments.',
    suggestions: [
      'Should I include my superannuation?',
      'How do I find my average purchase price?',
      'What\'s the difference between brokerage and managed funds?',
    ],
  },
  super: {
    title: 'Superannuation',
    description: 'I can help you add your super accounts. We capture the essentials now; deeper details land in Settings later.',
    suggestions: [
      'What fields do I need to enter for super?',
      'Where do I find my super fund name?',
      'Should I enter my contribution amounts now?',
      'Can I add multiple super accounts?',
    ],
  },
  assets: {
    title: 'Personal Assets',
    description: 'I can help you decide which assets to track.',
    suggestions: [
      'Which personal assets should I include?',
      'How do I estimate my car\'s current value?',
      'Should I track depreciating assets?',
    ],
  },
  'income-expenses': {
    title: 'Income & Expenses',
    description: 'I can help you set up accurate income and expense tracking.',
    suggestions: [
      'Should I enter gross or net salary?',
      'What expenses should I track?',
      'How detailed should my expense categories be?',
    ],
  },
  review: {
    title: 'Review & Launch',
    description: 'I can explain your financial summary and next steps.',
    suggestions: [
      'What does my net worth mean?',
      'Is my cashflow healthy?',
      'What should I do after setting up?',
    ],
  },
};

// =============================================================================
// MOCK AI RESPONSES (Replace with actual API call)
// =============================================================================

async function getAIResponse(question: string, stepId: WizardStepId): Promise<string> {
  // In production, this would call your AI API
  // For now, return contextual responses
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 500));

  const lowerQuestion = question.toLowerCase();

  // Profile type questions
  if (lowerQuestion.includes('profile') || lowerQuestion.includes('which') && lowerQuestion.includes('choose')) {
    return `Great question! Here's a quick guide:

**Homeowner** - Choose this if you own your primary residence with a mortgage but don't have investment properties.

**Investor** - Choose this if you have investment properties or significant share portfolios.

**Mixed** - Choose this if you have both property investments AND share/ETF investments.

**Starter** - Choose this if you're just getting started and want to track bank accounts and basic income/expenses.

You can always add more data later, so don't worry about getting it perfect!`;
  }

  // Property value questions
  if (lowerQuestion.includes('property') && lowerQuestion.includes('value')) {
    return `To estimate your property's current value, you can:

1. **Check recent sales** - Look at what similar properties in your area have sold for on Domain or Realestate.com.au

2. **Use online estimators** - CoreLogic, Domain, and PropTrack offer free estimates

3. **Get a bank valuation** - Your lender may have a recent valuation

4. **Commission an appraisal** - A real estate agent can provide a free market appraisal

Don't stress about being exact - an estimate within 10% is fine for tracking purposes!`;
  }

  // Fixed vs variable
  if (lowerQuestion.includes('fixed') && lowerQuestion.includes('variable')) {
    return `**Fixed Rate:**
- Interest rate is locked for a set period (1-5 years)
- Predictable repayments
- May have break costs if you refinance early

**Variable Rate:**
- Interest rate can change with the market
- More flexibility (extra repayments, redraw)
- Rate can go up or down

Most Australian borrowers have variable rates, but many split their loan (e.g., 50% fixed, 50% variable) for balance.`;
  }

  // Offset account
  if (lowerQuestion.includes('offset')) {
    return `An **offset account** is a transaction account linked to your home loan.

**How it works:**
The balance in your offset account is "offset" against your loan balance when calculating interest. For example:
- Loan balance: $500,000
- Offset balance: $50,000
- You only pay interest on: $450,000

**Benefits:**
- Reduces interest paid
- Money is still accessible
- Can save thousands over the life of your loan

Link your offset account in Monitrax to see the true interest savings!`;
  }

  // Gross vs net salary
  if (lowerQuestion.includes('gross') || lowerQuestion.includes('net') && lowerQuestion.includes('salary')) {
    return `**Gross salary** is your total salary before tax (what's in your employment contract).

**Net salary** is your take-home pay after tax and deductions.

**For Monitrax**, entering your **gross salary** is recommended because:
- We can calculate accurate tax estimates
- It's easier to verify (matches your contract)
- Cashflow projections will account for tax automatically

If you only know your net pay, that's fine too - just select "Net" when entering.`;
  }

  // Default response
  return `That's a great question about ${stepId === 'welcome' ? 'getting started' : stepId.replace('-', ' ')}!

While I don't have a specific answer for that, here are some tips:

1. **Don't worry about perfection** - Estimates are fine, you can always update later
2. **Start simple** - Add the big items first, details can come later
3. **Check your statements** - Your bank and loan statements have most numbers you need

Is there something specific about this step I can help clarify?`;
}

// =============================================================================
// AI HELPER BUTTON
// =============================================================================

interface AIHelperButtonProps {
  onClick: () => void;
  isOpen: boolean;
  /**
   * When provided, renders the button inline with this className instead
   * of the default floating pill. Use this to embed the trigger inside
   * the wizard header so it doesn't overlap the Back/Next buttons.
   */
  className?: string;
}

export function AIHelperButton({ onClick, isOpen, className }: AIHelperButtonProps) {
  if (isOpen) return null;

  // Inline variant — caller controls positioning (e.g. wizard header)
  if (className) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={className}
        aria-label="Open AI Assistant"
      >
        <Sparkles className="h-4 w-4" />
        <span className="text-xs font-medium">Need Help?</span>
      </button>
    );
  }

  // Legacy floating pill — kept for any non-wizard caller
  return (
    <button
      onClick={onClick}
      className="ai-helper-button fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all"
      aria-label="Open AI Assistant"
    >
      <Sparkles className="h-5 w-5" />
      <span className="font-medium">Need Help?</span>
    </button>
  );
}

// =============================================================================
// AI HELPER PANEL
// =============================================================================

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface AIHelperPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentStep: WizardStepId;
}

export function AIHelperPanel({ isOpen, onClose, currentStep }: AIHelperPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const context = STEP_CONTEXT[currentStep];

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 200);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await getAIResponse(input, currentStep);
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I had trouble responding. Please try again.',
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return createPortal(
    // Non-modal side drawer.
    // - z-[70] so it sits ABOVE the wizard (z-[60]) — otherwise the
    //   wizard's backdrop-blur makes the panel look blurred and unusable.
    // - No backdrop: the user should be able to read help AND keep
    //   interacting with the wizard form underneath.
    // - Anchored top-right so it never covers the wizard's Back/Next
    //   buttons (which live at the bottom-right of the wizard card).
    // - pointer-events gated so clicks outside the panel pass through
    //   to the wizard.
    <div className="fixed inset-0 z-[70] pointer-events-none">
      <div
        className={`pointer-events-auto absolute right-4 top-4 w-[min(92vw,24rem)] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl ring-1 ring-black/10 dark:ring-white/10 overflow-hidden flex flex-col ${
          isClosing ? 'ai-helper-panel-exit' : 'ai-helper-panel-enter'
        }`}
        style={{ maxHeight: 'calc(100vh - 32px)' }}
        role="dialog"
        aria-label="Wizard help assistant"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 bg-gradient-to-r from-blue-500 to-blue-600">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Monitrax Assistant</h3>
              <p className="text-xs text-blue-100">{context.title}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            aria-label="Close assistant"
          >
            <X className="h-5 w-5 text-white" />
          </button>
        </div>

        {/* Messages Area */}
        <div className="h-80 overflow-y-auto p-4 space-y-4">
          {/* Initial context message */}
          {messages.length === 0 && (
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {context.description}
                </p>
              </div>

              {/* Suggestions */}
              <div className="space-y-2">
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  Common questions:
                </p>
                {context.suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="w-full text-left text-sm p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message history */}
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2 ${
                  message.role === 'user'
                    ? 'bg-blue-500 text-white rounded-br-sm'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-sm'
                }`}
              >
                <div className="text-sm whitespace-pre-wrap">{message.content}</div>
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                  <span className="text-sm text-gray-500">Thinking...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me anything..."
              className="flex-1 px-4 py-2 rounded-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Send message"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// =============================================================================
// COMBINED AI HELPER COMPONENT
// =============================================================================

interface AIHelperProps {
  currentStep: WizardStepId;
  /**
   * Optional className override for the trigger button. When provided,
   * the button renders inline (e.g. inside the wizard header) instead of
   * as a floating bottom-right pill.
   */
  buttonClassName?: string;
}

export function AIHelper({ currentStep, buttonClassName }: AIHelperProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <AIHelperButton
        onClick={() => setIsOpen(true)}
        isOpen={isOpen}
        className={buttonClassName}
      />
      <AIHelperPanel
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        currentStep={currentStep}
      />
    </>
  );
}
