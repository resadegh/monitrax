'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import { appleEase } from '@/components/shell/motion';
import { Send, MessageSquare, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';


export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
}

interface AdviceChatThreadProps {
  open: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  isSending: boolean;
  onSend: (text: string) => Promise<void>;
  prefilledMessage?: string;
}

export function AdviceChatThread({
  open,
  onClose,
  messages,
  isSending,
  onSend,
  prefilledMessage,
}: AdviceChatThreadProps) {
  const reduced = useReducedMotion() ?? false;
  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefilledMessage) setText(prefilledMessage);
  }, [prefilledMessage]);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages.length, open]);

  async function submit() {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;
    setText('');
    await onSend(trimmed);
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.aside
            role="dialog"
            aria-label="Follow-up conversation with your Personal CFO"
            initial={reduced ? { opacity: 0 } : { opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, x: 60 }}
            transition={reduced ? { duration: 0.2 } : { duration: 0.4, ease: appleEase }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-foreground/10 bg-card/95 backdrop-blur-xl shadow-2xl sm:max-w-lg"
          >
            <header className="flex items-center justify-between border-b border-foreground/10 px-5 py-4">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-foreground/[0.06]">
                  <MessageSquare className="h-4 w-4 text-foreground/70" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold tracking-tight text-foreground">
                    Ask your Personal CFO
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Today&apos;s conversation — clears with the advice doc.
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                aria-label="Close chat"
                className="rounded-full text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            </header>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {messages.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                  <p>
                    No conversation yet today. Ask anything about your financial picture or the
                    recommendations above.
                  </p>
                  <p className="text-[11px] text-muted-foreground/70">
                    Numbers in replies come from your real snapshot — never invented.
                  </p>
                </div>
              )}
              {messages.map((m) => (
                <motion.div
                  key={m.id}
                  initial={reduced ? { opacity: 1 } : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={reduced ? { duration: 0 } : { duration: 0.3, ease: appleEase }}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-foreground text-background'
                        : 'bg-foreground/[0.06] text-foreground'
                    }`}
                  >
                    {m.content}
                  </div>
                </motion.div>
              ))}
              {isSending && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-foreground/50" />
                  <span
                    className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-foreground/50"
                    style={{ animationDelay: '150ms' }}
                  />
                  <span
                    className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-foreground/50"
                    style={{ animationDelay: '300ms' }}
                  />
                  <span>Thinking…</span>
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
              className="flex items-end gap-2 border-t border-foreground/10 px-5 py-4"
            >
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                placeholder="Ask a follow-up… (Enter to send, Shift+Enter for newline)"
                rows={2}
                maxLength={2000}
                className="min-h-[60px] resize-none rounded-xl border-foreground/15 bg-background/60 text-sm"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!text.trim() || isSending}
                className="h-10 w-10 flex-none rounded-full"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
