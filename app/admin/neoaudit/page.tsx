/**
 * NEOAUDIT ADMIN PANEL — /admin/neoaudit (R3-self surface)
 *
 * The one-click operator instrument from the NeoAudit blueprint
 * (docs/blueprint/NEOAUDIT.md §0 operator guide, §1.2 R3-self, §6 scorecard):
 * open it after money-touching merges / before a release → read the invariant
 * PASS/FAIL computed on YOUR real data by GET /api/verify/invariants.
 *
 * Admin-located operator tool (NOT a user-facing product surface) — so it uses
 * the admin design system, NOT Stitch/cosmos (§18.2). The invariant data is the
 * operator's own figures via the report.read endpoint (the operator is also a
 * user with their own data).
 */

import { AdminFeatureGate } from '@/components/admin/AdminFeatureGate';
import { NeoAuditPanel } from '@/components/admin/neoaudit/NeoAuditPanel';

export default function NeoAuditPage() {
  return (
    <AdminFeatureGate feature="adminPortalEnabled">
      <div className="p-4">
        <NeoAuditPanel />
      </div>
    </AdminFeatureGate>
  );
}
