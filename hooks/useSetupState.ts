'use client';

/**
 * useSetupState — Phase 12 v3 (dashboard-as-onboarding)
 *
 * Client hook that fetches `/api/setup/state` and exposes the
 * per-user setup task list + progress meter to React components.
 * This is the bridge between the Phase B foundation pipeline
 * (registry → service → API) and the Phase C UI (`<SetupTray>`).
 *
 * Architecture:
 *   - Mirrors the patterns established by `useOnboardingState` so
 *     consumers get a familiar shape (`{ data, isLoading, error,
 *     refetch }`-style return).
 *   - Auth via `useAuth().token`. The hook is a no-op until a token
 *     is available, so it is safe to mount on routes that may render
 *     before the auth context resolves.
 *   - Pure consumer of the API. Zero business logic, zero
 *     completion calculation, zero registry walking — those all live
 *     server-side in `lib/setup/tasks.ts` and `setupStateService.ts`
 *     per CLAUDE.md §12.2 (SSOT) and §12.3 (thin clients).
 *   - Aborts in-flight requests on unmount via AbortController so
 *     navigating away mid-fetch doesn't trigger a state update on an
 *     unmounted component.
 *   - Type-only import from `lib/setup/tasks` (server-safe — no
 *     prisma, no React) so the hook's bundle stays clean.
 *
 * See:
 *   - docs/blueprint/PHASE_12_REDESIGN_V3.md §2.1 (Setup Tray)
 *   - app/api/setup/state/route.ts (the endpoint this hook calls)
 *   - lib/services/setupStateService.ts (the service behind the route)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import type { SetupTask } from '@/lib/setup/tasks';

// =============================================================================
// PUBLIC TYPES
// =============================================================================

/**
 * One row in the setup tray response. Mirrors `SetupTaskState` from
 * `setupStateService` but is redefined here so the hook does not pull
 * the server-side service module into the client bundle.
 */
export interface UseSetupStateTask {
  task: SetupTask;
  isDone: boolean;
}

/**
 * Progress summary returned by the API. `percent` is a 0-100 integer,
 * ready for direct UI rendering.
 */
export interface UseSetupStateProgress {
  done: number;
  total: number;
  percent: number;
  allDone: boolean;
}

// Phase 12 twin-track (A.1): per-module progress types mirrored
// client-side so consumers can import everything they need from this
// single hook. Kept in sync with `lib/services/setupStateService.ts`
// — DO NOT let them drift.
export type UseSetupStateModuleKey =
  | 'accounts'
  | 'properties'
  | 'income'
  | 'expenses'
  | 'investments'
  | 'loans';

export type UseSetupStateModuleState = 'Missing' | 'Estimated' | 'Verified';

export interface UseSetupStateModuleProgress {
  module: UseSetupStateModuleKey;
  state: UseSetupStateModuleState;
  percent: number;
  rowCount: number;
  estimatedCount: number;
  verifiedCount: number;
}

export interface UseSetupStateReturn {
  /** Ordered task list with per-task `isDone` flags. `null` until the first fetch resolves. */
  tasks: UseSetupStateTask[] | null;
  /** Precomputed progress summary. `null` until the first fetch resolves. */
  progress: UseSetupStateProgress | null;
  /**
   * Phase 12 twin-track (A.1): per-module Missing/Estimated/Verified
   * state for the 6 `/dashboard/setup` tiles. `null` until the first
   * fetch resolves. Consumed by Track A.3 card prioritisation, A.5
   * confidence badges, and A.2 `<SetupNextActionPanel />`.
   */
  moduleProgress: UseSetupStateModuleProgress[] | null;
  /** True while the first or a refetch is in flight. */
  isLoading: boolean;
  /** Last fetch error message, or `null` on success. */
  error: string | null;
  /** Manual re-fetch trigger. Returns the same Promise as the underlying fetch so callers can `await` it. */
  refetch: () => Promise<void>;
}

// =============================================================================
// API ENVELOPE TYPES (match CLAUDE.md §6.6)
// =============================================================================

interface SetupStateApiSuccess {
  success: true;
  data: {
    tasks: UseSetupStateTask[];
    progress: UseSetupStateProgress;
    // Phase 12 twin-track (A.1): added as an additive field to the
    // API response. Existing consumers that only read tasks/progress
    // are unaffected.
    moduleProgress: UseSetupStateModuleProgress[];
  };
  error: null;
  meta: { timestamp: string; durationMs: number };
}

interface SetupStateApiError {
  success: false;
  data: null;
  error: { code: string; message: string; details: unknown };
  meta: { timestamp: string; durationMs: number };
}

type SetupStateApiResponse = SetupStateApiSuccess | SetupStateApiError;

// =============================================================================
// HOOK
// =============================================================================

export function useSetupState(): UseSetupStateReturn {
  const { token } = useAuth();
  const [tasks, setTasks] = useState<UseSetupStateTask[] | null>(null);
  const [progress, setProgress] = useState<UseSetupStateProgress | null>(null);
  // Phase 12 twin-track (A.1): per-module progress state.
  const [moduleProgress, setModuleProgress] = useState<
    UseSetupStateModuleProgress[] | null
  >(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // AbortController for the in-flight request. Refreshed on every
  // refetch so a stale request can be cancelled in favour of a newer
  // one, and aborted on unmount to avoid setState-after-unmount.
  const abortRef = useRef<AbortController | null>(null);

  const refetch = useCallback(async () => {
    // No token → user is signed out or the auth context hasn't
    // resolved yet. Quietly no-op; the effect below will retry once
    // a token appears.
    if (!token) return;

    // Cancel any in-flight request before starting a new one.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/setup/state', {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      const json: SetupStateApiResponse = await response.json();

      if (!response.ok || json.success === false) {
        const message =
          json.success === false
            ? json.error?.message || 'Failed to load setup state'
            : `Failed to load setup state (HTTP ${response.status})`;
        throw new Error(message);
      }

      // Only commit state if this controller is still the active one.
      // Guards against a stale response landing after a newer refetch
      // has already started.
      if (abortRef.current === controller) {
        setTasks(json.data.tasks);
        setProgress(json.data.progress);
        // Phase 12 twin-track (A.1): commit per-module progress.
        // Defaults to `[]` (empty array) if the server hasn't been
        // upgraded yet, so older server + newer client cannot crash.
        setModuleProgress(json.data.moduleProgress ?? []);
      }
    } catch (err) {
      // Aborts are not real errors — just bail without updating state.
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (abortRef.current === controller) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      }
    } finally {
      if (abortRef.current === controller) {
        setIsLoading(false);
      }
    }
  }, [token]);

  // Initial fetch + token-change refetch.
  useEffect(() => {
    if (token) {
      void refetch();
    }
    // Cleanup: abort the in-flight request if the component unmounts
    // or the token changes mid-fetch.
    return () => {
      abortRef.current?.abort();
    };
  }, [refetch, token]);

  return {
    tasks,
    progress,
    moduleProgress,
    isLoading,
    error,
    refetch,
  };
}
