/**
 * /dashboard/wealth-explorer — Wealth Explorer surface-design preview.
 *
 * Light-touch v1 — pure visual surface, no real entity data wired, no
 * interactivity beyond what's needed to demonstrate the look. Hover state
 * is rendered statically on the HOME tile so Reza can review the surface
 * in prod before we go deep on the build.
 *
 * Source of truth: `.stitch/designs/wealth-explorer-v5-universe-dark.png`
 * (Stitch screen `a3b43b9164d74f1c8ec53bc20f319cbd`).
 *
 * Next iteration (post-approval): wire real entities from
 * `/api/entities`, add interactive hover, click → Level 2 ecosystem zoom,
 * click → Level 3 EntityDetailPanel, mobile bottom-sheet pattern.
 */

'use client';

import DashboardLayout from '@/components/DashboardLayout';
import WealthUniverseCanvas from '@/components/wealth-explorer/WealthUniverseCanvas';

export default function WealthExplorerPage() {
  return (
    <DashboardLayout>
      {/* Canvas takes the full content area — no extra padding/wrapper. */}
      <div className="-m-4 sm:-m-6 lg:-m-8">
        <WealthUniverseCanvas />
      </div>
    </DashboardLayout>
  );
}
