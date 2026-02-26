'use client';

/**
 * Idle Timeout Guard
 *
 * Automatically logs out users after 30 minutes of inactivity.
 * Shows a 2-minute warning dialog before logout.
 *
 * Activity is tracked via mouse movement, keyboard input, touch events,
 * and scroll events. Any of these resets the idle timer.
 *
 * Only active when the user is authenticated (has a token).
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/lib/context/AuthContext';

/** Total idle time before logout (ms) */
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

/** Time before logout when the warning appears (ms) */
const WARNING_BEFORE_MS = 2 * 60 * 1000; // 2 minutes

/** When to show the warning = total timeout - warning lead time */
const WARNING_AT_MS = IDLE_TIMEOUT_MS - WARNING_BEFORE_MS; // 28 minutes

/** Events that count as user activity */
const ACTIVITY_EVENTS: (keyof DocumentEventMap)[] = [
  'mousedown',
  'mousemove',
  'keydown',
  'touchstart',
  'scroll',
  'click',
];

export function IdleTimeoutGuard() {
  const { token, logout } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastActivityRef = useRef(Date.now());

  const clearAllTimers = useCallback(() => {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    warningTimerRef.current = null;
    logoutTimerRef.current = null;
    countdownRef.current = null;
  }, []);

  const startTimers = useCallback(() => {
    clearAllTimers();
    lastActivityRef.current = Date.now();
    setShowWarning(false);

    // Timer to show warning dialog
    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      setSecondsLeft(Math.ceil(WARNING_BEFORE_MS / 1000));

      // Start countdown
      countdownRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, WARNING_AT_MS);

    // Timer to auto-logout
    logoutTimerRef.current = setTimeout(() => {
      clearAllTimers();
      setShowWarning(false);
      logout();
    }, IDLE_TIMEOUT_MS);
  }, [clearAllTimers, logout]);

  const handleActivity = useCallback(() => {
    // Only reset if warning is NOT showing — once warning is visible,
    // user must explicitly click "Stay Logged In"
    if (!showWarning) {
      startTimers();
    }
  }, [showWarning, startTimers]);

  const handleStayLoggedIn = useCallback(() => {
    setShowWarning(false);
    startTimers();
  }, [startTimers]);

  // Set up activity listeners when authenticated
  useEffect(() => {
    if (!token) {
      clearAllTimers();
      setShowWarning(false);
      return;
    }

    startTimers();

    const handler = () => handleActivity();

    for (const event of ACTIVITY_EVENTS) {
      document.addEventListener(event, handler, { passive: true });
    }

    return () => {
      clearAllTimers();
      for (const event of ACTIVITY_EVENTS) {
        document.removeEventListener(event, handler);
      }
    };
  }, [token, startTimers, handleActivity, clearAllTimers]);

  // Don't render anything if not authenticated or no warning to show
  if (!token || !showWarning) {
    return null;
  }

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <div className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
            <svg
              className="w-6 h-6 text-amber-600 dark:text-amber-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>

          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Session Timeout
          </h2>

          <p className="text-gray-600 dark:text-gray-400 mb-4">
            You&apos;ve been inactive for a while. For your security, you&apos;ll be
            automatically logged out in:
          </p>

          <div className="text-3xl font-mono font-bold text-amber-600 dark:text-amber-400 mb-6">
            {minutes}:{seconds.toString().padStart(2, '0')}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                clearAllTimers();
                setShowWarning(false);
                logout();
              }}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Log Out Now
            </button>
            <button
              onClick={handleStayLoggedIn}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Stay Logged In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
