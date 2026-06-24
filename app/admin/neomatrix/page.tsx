'use client';

/**
 * Phase 53 N2 — Neomatrix Explorer admin page.
 *
 * Admin-side only. Renders the 3D financial-logic knowledge-graph explorer.
 * Never a user-facing surface — it exposes internal architecture (engine
 * names, file:line, formulas). Mirrors the `/admin/calc-audit` guard posture:
 * `AdminFeatureGate` on the page + admin auth (`audit:read`) on the API.
 *
 * The graph is METADATA ONLY — no CDR/user data (Phase 53 §9).
 */

import { AdminFeatureGate } from '@/components/admin/AdminFeatureGate';
import { NeomatrixExplorer } from '@/components/admin/neomatrix/NeomatrixExplorer';

export default function NeomatrixPage() {
  return (
    <AdminFeatureGate feature="adminPortalEnabled">
      <div className="p-2">
        <NeomatrixExplorer />
      </div>
    </AdminFeatureGate>
  );
}
