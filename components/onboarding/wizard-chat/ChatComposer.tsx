'use client';

/**
 * Chat composer — text input + opt-in mic button.
 *
 * Phase 12 §6: text-first by default. The mic button is hidden when
 * Web Speech API isn't supported (Safari iOS quirks). Mic permission
 * is requested ONLY when the user taps the mic — never on page load.
 *
 * Submission: Enter without shift sends; Shift+Enter inserts a newline.
 */

import { useCallback, useEffect, useState, type KeyboardEvent } from 'react';
import { Mic, Send, StopCircle } from 'lucide-react';
import { useVoiceInput } from '@/hooks/useVoiceInput';

interface ChatComposerProps {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatComposer({
  onSubmit,
  disabled = false,
  placeholder = 'Type your reply, or tap the mic to speak…',
}: ChatComposerProps) {
  const [value, setValue] = useState('');

  const handleFinalTranscript = useCallback(
    (text: string) => {
      setValue((current) => (current.length > 0 ? `${current} ${text}` : text));
    },
    [],
  );

  const voice = useVoiceInput({ onFinal: handleFinalTranscript });

  // Mirror interim transcript into the input field so the user sees
  // what's being captured live. The interim text replaces nothing —
  // the FINAL transcript is what lands via handleFinalTranscript.
  // We display interim by combining with `value` in the textarea
  // value below.
  const displayValue =
    voice.isListening && voice.interimTranscript.length > 0
      ? `${value} ${voice.interimTranscript}`.trim()
      : value;

  const submit = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed.length === 0 || disabled) return;
    onSubmit(trimmed);
    setValue('');
  }, [value, disabled, onSubmit]);

  const handleKey = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submit();
      }
    },
    [submit],
  );

  // Auto-stop mic if disabled flips true mid-listen (e.g. while
  // waiting for the agent reply, we don't want the mic running).
  useEffect(() => {
    if (disabled && voice.isListening) {
      voice.stop();
    }
  }, [disabled, voice]);

  return (
    <div className="flex items-end gap-2 rounded-2xl border border-slate-200/70 bg-white/90 p-2 shadow-sm focus-within:border-blue-400/60 focus-within:ring-2 focus-within:ring-blue-500/20 dark:border-slate-700/70 dark:bg-slate-900/70 dark:focus-within:border-blue-400/60">
      <textarea
        value={displayValue}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKey}
        disabled={disabled}
        rows={1}
        placeholder={placeholder}
        className="min-h-[40px] max-h-[120px] flex-1 resize-none bg-transparent px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-60 dark:text-slate-100 dark:placeholder:text-slate-500"
      />

      {voice.isSupported && (
        <button
          type="button"
          onClick={() => (voice.isListening ? voice.stop() : voice.start())}
          disabled={disabled}
          aria-label={voice.isListening ? 'Stop recording' : 'Start recording'}
          aria-pressed={voice.isListening}
          className={
            'inline-flex h-10 w-10 items-center justify-center rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-40 motion-reduce:transition-none ' +
            (voice.isListening
              ? 'bg-red-500 text-white shadow-sm hover:bg-red-600'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700')
          }
        >
          {voice.isListening ? <StopCircle className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={disabled || value.trim().length === 0}
        aria-label="Send"
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-500 text-white shadow-[0_8px_24px_-12px_rgba(99,102,241,0.55)] transition-opacity hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-40 motion-reduce:transition-none"
      >
        <Send className="h-5 w-5" />
      </button>
    </div>
  );
}
