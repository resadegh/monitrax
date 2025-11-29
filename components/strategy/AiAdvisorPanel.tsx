/**
 * AI ADVISOR PANEL
 * Phase 11 - AI Strategy Engine UI V2
 *
 * Chat-like interface for AI-powered financial advice
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Bot,
  Send,
  RefreshCw,
  User,
  AlertTriangle,
  Sparkles,
  HelpCircle,
  Lightbulb,
  TrendingUp,
  Shield,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface AiAdvisorPanelProps {
  mode: 'portfolio' | 'entity' | 'recommendation';
  entityId?: string;
  entityType?: 'property' | 'loan' | 'investment';
  recommendationId?: string;
  onConversationUpdated?: (conversationId: string) => void;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestions?: string[];
}

interface QuickAction {
  label: string;
  question: string;
  icon: React.ReactNode;
}

// =============================================================================
// QUICK ACTIONS
// =============================================================================

const PORTFOLIO_QUICK_ACTIONS: QuickAction[] = [
  { label: 'Financial Health', question: 'How is my overall financial health?', icon: <TrendingUp className="h-3 w-3" /> },
  { label: 'Risk Assessment', question: 'What are my main financial risks?', icon: <Shield className="h-3 w-3" /> },
  { label: 'Next Steps', question: 'What should be my next financial priority?', icon: <Lightbulb className="h-3 w-3" /> },
];

const RECOMMENDATION_QUICK_ACTIONS: QuickAction[] = [
  { label: 'Explain this', question: 'Can you explain this recommendation in simple terms?', icon: <HelpCircle className="h-3 w-3" /> },
  { label: 'Risks', question: 'What are the risks if I follow this recommendation?', icon: <Shield className="h-3 w-3" /> },
  { label: 'Alternatives', question: 'What are the alternative approaches?', icon: <Lightbulb className="h-3 w-3" /> },
];

const ENTITY_QUICK_ACTIONS: QuickAction[] = [
  { label: 'Performance', question: 'How is this asset performing?', icon: <TrendingUp className="h-3 w-3" /> },
  { label: 'Optimize', question: 'How can I optimize this asset?', icon: <Sparkles className="h-3 w-3" /> },
  { label: 'Risks', question: 'What risks should I be aware of?', icon: <Shield className="h-3 w-3" /> },
];

// =============================================================================
// COMPONENT
// =============================================================================

export default function AiAdvisorPanel({
  mode,
  entityId,
  entityType,
  recommendationId,
  onConversationUpdated,
}: AiAdvisorPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Get quick actions based on mode
  const quickActions = mode === 'portfolio'
    ? PORTFOLIO_QUICK_ACTIONS
    : mode === 'recommendation'
    ? RECOMMENDATION_QUICK_ACTIONS
    : ENTITY_QUICK_ACTIONS;

  // Send a message to the AI
  async function sendMessage(question: string) {
    if (!question.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: question,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      let endpoint = '/api/ai/ask';
      let body: any = { question };

      // Add context based on mode
      if (mode === 'recommendation' && recommendationId) {
        body.recommendationId = recommendationId;
        body.question = `Regarding this strategy recommendation: ${question}`;
      } else if (mode === 'entity' && entityId && entityType) {
        body.entityId = entityId;
        body.entityType = entityType;
        body.question = `Regarding my ${entityType}: ${question}`;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to get AI response');
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.data?.answer || 'I apologize, but I was unable to generate a response.',
        timestamp: new Date(),
        suggestions: data.data?.suggestions,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Notify parent of conversation update
      if (onConversationUpdated) {
        onConversationUpdated(userMessage.id);
      }
    } catch (err) {
      console.error('AI request error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');

      // Add error message
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I apologize, but I encountered an error: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  function handleSuggestionClick(suggestion: string) {
    sendMessage(suggestion);
  }

  function clearChat() {
    setMessages([]);
    setError(null);
  }

  return (
    <div className="flex flex-col h-full max-h-[500px]">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 min-h-[200px]">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <Bot className="h-12 w-12 text-purple-300 dark:text-purple-700 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
              Ask me anything about {mode === 'portfolio' ? 'your finances' : mode === 'recommendation' ? 'this recommendation' : `this ${entityType}`}
            </p>
            {/* Quick Actions */}
            <div className="flex flex-wrap justify-center gap-2">
              {quickActions.map((action, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(action.question)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                >
                  {action.icon}
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg p-3 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {message.role === 'assistant' && (
                      <Bot className="h-4 w-4 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                    )}
                    {message.role === 'user' && (
                      <User className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                      {/* Suggestions */}
                      {message.suggestions && message.suggestions.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Follow-up questions:</p>
                          <div className="flex flex-wrap gap-1">
                            {message.suggestions.map((suggestion, i) => (
                              <button
                                key={i}
                                onClick={() => handleSuggestionClick(suggestion)}
                                className="text-xs px-2 py-1 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 transition-colors"
                              >
                                {suggestion}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}

        {/* Loading indicator */}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-purple-600 dark:text-purple-400 animate-spin" />
                <span className="text-sm text-gray-500 dark:text-gray-400">Thinking...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <div className="mb-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-xs text-yellow-700 dark:text-yellow-300 flex items-start gap-2">
        <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
        <span>AI-generated explanation – not personal financial advice. Consult a licensed advisor.</span>
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question..."
          disabled={loading}
          className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
        />
        <Button
          type="submit"
          disabled={loading || !input.trim()}
          className="bg-purple-600 hover:bg-purple-700 text-white"
          size="sm"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>

      {/* Clear Chat */}
      {messages.length > 0 && (
        <button
          onClick={clearChat}
          className="mt-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
        >
          Clear conversation
        </button>
      )}
    </div>
  );
}
