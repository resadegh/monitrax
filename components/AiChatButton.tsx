/**
 * AI CHAT FLOATING BUTTON
 * Phase 11 - AI Strategy Engine UI V2
 *
 * Floating button that opens an AI chat panel on any page
 */

'use client';

import { useState } from 'react';
import { Bot, X, MessageCircle, Sparkles } from 'lucide-react';
import AiAdvisorPanel from '@/components/strategy/AiAdvisorPanel';

export default function AiChatButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          fixed bottom-6 right-6 z-50
          w-14 h-14 rounded-full shadow-lg
          flex items-center justify-center
          transition-all duration-300 ease-in-out
          ${isOpen
            ? 'bg-gray-600 hover:bg-gray-700 rotate-0'
            : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700'
          }
          hover:scale-110 active:scale-95
          group
        `}
        aria-label={isOpen ? 'Close AI Chat' : 'Open AI Chat'}
      >
        {isOpen ? (
          <X className="h-6 w-6 text-white" />
        ) : (
          <>
            <Bot className="h-6 w-6 text-white" />
            {/* Pulse animation when closed */}
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full animate-pulse" />
          </>
        )}
      </button>

      {/* Tooltip when hovering (only when closed) */}
      {!isOpen && (
        <div className="fixed bottom-6 right-24 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-gray-900 text-white text-sm px-3 py-2 rounded-lg shadow-lg whitespace-nowrap">
            Ask AI Advisor
          </div>
        </div>
      )}

      {/* Chat Panel */}
      <div
        className={`
          fixed bottom-24 right-6 z-50
          w-[380px] max-w-[calc(100vw-3rem)]
          bg-white dark:bg-gray-900
          rounded-2xl shadow-2xl
          border border-gray-200 dark:border-gray-700
          transition-all duration-300 ease-in-out
          ${isOpen
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-4 pointer-events-none'
          }
        `}
      >
        {/* Panel Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-600 to-blue-600 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-white/20 rounded-lg">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-sm">AI Financial Advisor</h3>
              <p className="text-white/70 text-xs">Ask me anything about your finances</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4 text-white" />
          </button>
        </div>

        {/* Chat Content */}
        <div className="h-[450px] max-h-[60vh] overflow-hidden">
          {isOpen && (
            <AiAdvisorPanel
              mode="portfolio"
              onConversationUpdated={(id) => {
                console.log('Conversation updated:', id);
              }}
            />
          )}
        </div>

        {/* Panel Footer */}
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-2xl">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            AI advice is informational only. Consult a financial advisor for decisions.
          </p>
        </div>
      </div>

      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  );
}
