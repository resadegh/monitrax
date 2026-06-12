/**
 * Organization license suspension guard.
 *
 * WHY THIS EXISTS (2026-06-12, admin-portal org-detail PR)
 * --------------------------------------------------------
 * The admin portal can suspend an organisation's license
 * (`OrganizationLicense.status = 'suspended'` via
 * `PATCH /api/admin/organizations/:orgId/license`), but nothing in the
 * portal layer read that status — a suspended firm retained full access
 * to client financial data. This helper is the single source of truth
 * for "is this org's license suspended?", wired into the three canonical
 * access points:
 *
 *   1. `lib/portal/adviserClientAccess.ts` → `verifyAdviserClientAccess()`
 *      — the canonical client-data gate (snapshot / entities / money-flow).
 *   2. `lib/services/masterFinancialService.ts` → `loadOrganizationClient()`
 *      — the scoped-snapshot consent verifier.
 *   3. `lib/auth/guards.ts` → `withPortalFeatureGate()` — plan-gated
 *      portal features.
 *
 * Suspension semantics: org suspension is a BILLING/COMPLIANCE state on
 * the firm, NOT an identity action — members keep their personal Monitrax
 * accounts and sign-in (contrast: admin USER suspension disables the GCP
 * identity, see docs/operational/security/01_AUTHENTICATION.md
 * § User Suspension). What a suspended org loses is access to CLIENT data
 * and gated portal features.
 *
 * Reviewers: any new portal surface that exposes client data must route
 * through `verifyAdviserClientAccess()` (which calls this) — same rule
 * that file's header already states.
 */

import { prisma } from '@/lib/db';

/**
 * True when the organisation's license is suspended. An org with NO
 * license row is NOT suspended (licenses are created lazily on first
 * admin touch; absence means default/trial state, not punishment).
 */
export async function isOrgLicenseSuspended(organizationId: string): Promise<boolean> {
  const license = await prisma.organizationLicense.findUnique({
    where: { organizationId },
    select: { status: true },
  });
  return license?.status === 'suspended';
}
