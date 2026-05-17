'use client';

/**
 * Web Speech API STT wrapper for the conversational onboarding chat.
 *
 * Phase 12 §6 (Voice I/O strategy): browser-native STT only in v1 —
 * no audio leaves the device, no new CDR-relevant vendor, no new
 * credential surface. The browser's SpeechRecognition (Chrome / Edge)
 * or webkitSpeechRecognition (Safari) handles the audio → text
 * conversion locally.
 *
 * Returns:
 *   - `isSupported`: false on browsers without the API (older Firefox,
 *     some embedded browsers). Caller should hide the mic button when
 *     false.
 *   - `isListening`: true while actively transcribing.
 *   - `interimTranscript`: partial transcript while speaking.
 *   - `start()` / `stop()`: opt-in per turn — never auto-started on
 *     page load, never holds the mic open between turns.
 *   - `onFinal(text)`: caller supplies a callback fired with the
 *     final transcript when recognition ends.
 *
 * Design lens (Phase 12 §4a): no `prefers-reduced-motion` impact —
 * mic state is functional, not animated. The presence-orb's
 * ripple-sync to audio level (E.2b) will wire through this hook in
 * a follow-up PR; v1 ships without ripple sync.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

type SpeechRecognitionEvent = Event & {
  results: SpeechRecognitionResultList;
  resultIndex: number;
};

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionResult = ArrayLike<SpeechRecognitionAlternative> & {
  isFinal: boolean;
};
type SpeechRecognitionResultList = ArrayLike<SpeechRecognitionResult>;
type SpeechRecognitionAlternative = { transcript: string };

interface UseVoiceInputOptions {
  onFinal: (text: string) => void;
  lang?: string;
}

interface UseVoiceInputResult {
  isSupported: boolean;
  isListening: boolean;
  interimTranscript: string;
  start: () => void;
  stop: () => void;
}

function getSpeechRecognitionCtor(): { new (): SpeechRecognitionInstance } | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: { new (): SpeechRecognitionInstance };
    webkitSpeechRecognition?: { new (): SpeechRecognitionInstance };
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useVoiceInput({ onFinal, lang = 'en-AU' }: UseVoiceInputOptions): UseVoiceInputResult {
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const Ctor = getSpeechRecognitionCtor();
  const isSupported = Ctor !== null;

  useEffect(() => {
    return () => {
      // Cleanup on unmount — release the mic if listening.
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const start = useCallback(() => {
    if (!Ctor) return;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
    }

    const recog = new Ctor();
    recog.continuous = false;
    recog.interimResults = true;
    recog.lang = lang;

    recog.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? '';
        if (result.isFinal) {
          finalText += transcript;
        } else {
          interim += transcript;
        }
      }
      setInterimTranscript(interim);
      if (finalText.trim().length > 0) {
        onFinal(finalText.trim());
      }
    };

    recog.onerror = () => {
      setIsListening(false);
      setInterimTranscript('');
    };

    recog.onend = () => {
      setIsListening(false);
      setInterimTranscript('');
    };

    recognitionRef.current = recog;
    try {
      recog.start();
      setIsListening(true);
    } catch {
      setIsListening(false);
    }
  }, [Ctor, lang, onFinal]);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setIsListening(false);
  }, []);

  return { isSupported, isListening, interimTranscript, start, stop };
}
