/**
 * GET /api/setup/state — Phase 12 v3 (dashboard-as-onboarding)
 *
 * Returns the per-user setup tray state: the ordered task list with
 * per-task `isDone` flags and a precomputed progress summary.
 *
 * This is the API surface the future `<SetupTray>` component (Phase C)
 * will call to render the dashboard chrome's setup checklist.
 *
 * Architecture:
 *   - Pure thin wrapper per CLAUDE.md §12.3. All work happens in
 *     `lib/services/setupStateService.ts`; this file only handles
 *     auth gating, response shaping, and error mapping.
 *   - Auth via `withPermission('settings.read', …)` — same gate the
 *     existing `/api/onboarding/state` route uses, since the setup
 *     tray is a settings-adjacent UI surface, not CDR data.
 *   - Response envelope follows CLAUDE.md §6.6:
 *       { success, data, error, meta: { timestamp, durationMs } }
 *   - No business logic, no inline calculations, no manual data
 *     aggregation — the registry from `lib/setup/tasks.ts` and the
 *     service from `lib/services/setupStateService.ts` are the only
 *     places that define what setup state means.
 *
 * See:
 *   - docs/blueprint/PHASE_12_REDESIGN_V3.md §2.1 (Setup Tray)
 *   - lib/services/setupStateService.ts (the service this route wraps)
 *   - lib/setup/tasks.ts (the canonical task registry)
 */

import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { getSetupState } from '@/lib/services/setupStateService';

export const GET = withPermission('settings.read', async (_request, auth) => {
  const startedAt = Date.now();
  try {
    const data = await getSetupState(auth.userId);
    return NextResponse.json({
      success: true,
      data,
      error: null,
      meta: {
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
      },
    });
  } catch (error) {
    console.error('GET /api/setup/state failed:', error);
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: {
          code: 'SETUP_STATE_FETCH_FAILED',
          message: 'Could not load setup state',
          details: null,
        },
        meta: {
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - startedAt,
        },
      },
      { status: 500 }
    );
  }
});
