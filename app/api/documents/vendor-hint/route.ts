/**
 * Phase 50 D.4 — Vendor routing hint API (suggest-only).
 *
 * GET /api/documents/vendor-hint?vendor=<name>
 * Returns the entity the user usually files documents from this vendor under,
 * so the "What is this for?" selector can PRE-SELECT it. The client treats the
 * result as a suggestion to highlight — never an instruction to auto-apply.
 * The user always confirms (and can change) in the existing flow.
 *
 * Thin wrapper over the canonical learnedRouting service (§12.3) — no logic
 * here beyond reading the query param and shaping the response.
 */

import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { getVendorEntityHint } from '@/lib/documents/intelligence/learnedRouting';

export const GET = withPermission('report.export', async (request, auth) => {
  try {
    const vendor = new URL(request.url).searchParams.get('vendor') ?? '';
    if (!vendor.trim()) {
      return NextResponse.json({ success: true, hint: null });
    }

    const hint = await getVendorEntityHint(auth.userId, vendor);
    return NextResponse.json({ success: true, hint });
  } catch (error) {
    console.error('[API] vendor-hint error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load routing hint', hint: null },
      { status: 500 }
    );
  }
});
