/**
 * Phase 32B PR3 — Plan-tier feature gates for the Practice surface.
 *
 * Reza's pricing matrix (locked 2026-05-04, see IMPLEMENTATION_PLAN.md):
 *   Studio    AU$199/mo   solo / micro practice
 *   Practice  AU$599/mo   small-to-mid firm with team + client overflow
 *   Enterprise from $1,499  white-label, SSO, API, audit retention
 *
 * The Prisma `OrganizationPlan` enum predates this naming (STARTER /
 * PROFESSIONAL / BUSINESS / ENTERPRISE) and is the on-disk source of truth.
 * This module maps the legacy enum to the new tier names and exposes a
 * single canonical feature registry so route handlers + UI both read from
 * the same place. Per CLAUDE.md §12.2 SSOT.
 *
 * Tech-debt #14 (queued): rename the Prisma enum once a clean migration
 * window opens. Until then this mapping stands in.
 */

import type { OrganizationPlan } from '@prisma/client';

export type PlanTier = 'STUDIO' | 'PRACTICE' | 'ENTERPRISE';

const LEGACY_TO_TIER: Record<OrganizationPlan, PlanTier> = {
  STARTER: 'STUDIO',
  PROFESSIONAL: 'PRACTICE',
  BUSINESS: 'PRACTICE', // Mid-firm rolls up into Practice tier capabilities
  ENTERPRISE: 'ENTERPRISE',
};

export function mapPlanToTier(plan: OrganizationPlan | null | undefined): PlanTier {
  if (!plan) return 'STUDIO';
  return LEGACY_TO_TIER[plan] ?? 'STUDIO';
}

/**
 * Plan-tier feature flags. Driven by Reza's monetisation matrix; gated at
 * the route layer via `withPortalFeatureGate()` in lib/auth/guards.ts.
 *
 * Audit-log retention is exposed as a number of days (rather than a boolean)
 * because the value drives both UI copy ("see the last 30 days") and the
 * actual log-export window. STUDIO honours the default app-wide 90-day
 * window for AuditLog rows; PRACTICE and ENTERPRISE extend it to support
 * the 7-year CDR-aligned compliance archive promised in the pricing matrix.
 */
export interface PlanFeatures {
  /** SAML SSO toggle in /portal/settings */
  sso: boolean;
  /** White-label settings (logo, brand colours, custom domain) */
  whiteLabel: boolean;
  /** Custom domain on top of white-label (Enterprise-only) */
  customDomain: boolean;
  /** API key creation surface */
  apiKeyCreate: boolean;
  /** Audit-log retention window exposed to the org (days) */
  auditLogRetentionDays: number;
  /** Concurrent professional seats included */
  includedSeats: number;
  /** Included clients before per-client overflow billing kicks in */
  includedClients: number;
}

export const PLAN_FEATURES: Record<PlanTier, PlanFeatures> = {
  STUDIO: {
    sso: false,
    whiteLabel: false,
    customDomain: false,
    apiKeyCreate: false,
    auditLogRetentionDays: 90,
    includedSeats: 1,
    includedClients: 25,
  },
  PRACTICE: {
    sso: false,
    whiteLabel: true,
    customDomain: false,
    apiKeyCreate: true,
    auditLogRetentionDays: 365,
    includedSeats: 5,
    includedClients: 150,
  },
  ENTERPRISE: {
    sso: true,
    whiteLabel: true,
    customDomain: true,
    apiKeyCreate: true,
    // 7-year CDR-aligned archive — actual archival lives in Cloud Logging,
    // see CLAUDE.md §13.5 and docs/operational/security/03_CDR_COMPLIANCE.md.
    auditLogRetentionDays: 365 * 7,
    includedSeats: -1, // Unlimited (subject to fair use)
    includedClients: -1,
  },
};

export type PortalFeatureKey =
  | 'sso'
  | 'whiteLabel'
  | 'customDomain'
  | 'apiKeyCreate';

/**
 * Booleans only — for route-layer gating. `auditLogRetentionDays` is a number
 * and is consumed by the audit-log query layer separately.
 */
export function planAllowsFeature(tier: PlanTier, feature: PortalFeatureKey): boolean {
  const flags = PLAN_FEATURES[tier];
  return Boolean(flags[feature]);
}

export const TIER_LABEL: Record<PlanTier, string> = {
  STUDIO: 'Studio',
  PRACTICE: 'Practice',
  ENTERPRISE: 'Enterprise',
};

// =============================================================================
// PHASE 32C PR6 — LIVE STRIPE SUBSCRIPTION INTEGRATION
// =============================================================================
//
// At Phase 32B PR3 the planTier was read from `OrganizationPortalSettings.plan`
// (the static admin-set tier). Phase 32C PR6 makes Stripe the authoritative
// source: an active StripeSubscription row overrides the static plan. The
// fallback is preserved so:
//   - Orgs that haven't entered the billing flow yet keep their admin-set tier
//   - Test envs without a STRIPE_SECRET_KEY can still gate features

import { prisma } from '@/lib/db';
import type { BillingPlanTier, SubscriptionStatus } from '@prisma/client';

const ACTIVE_STATUSES: SubscriptionStatus[] = ['TRIALING', 'ACTIVE', 'PAST_DUE'];

const BILLING_TO_TIER: Record<BillingPlanTier, PlanTier> = {
  STUDIO: 'STUDIO',
  PRACTICE: 'PRACTICE',
  ENTERPRISE: 'ENTERPRISE',
};

/**
 * Resolve the canonical PlanTier for an organisation, prefering a LIVE
 * Stripe subscription over the static legacy plan column. Used by the
 * route-layer feature gates so feature access tracks billing state.
 *
 * `PAST_DUE` is treated as still-entitled — Stripe gives a 3-day grace
 * window before transitioning to UNPAID; we keep features on during the
 * grace window. `INCOMPLETE_EXPIRED` / `UNPAID` / `CANCELED` fall through
 * to the legacy plan (which typically resolves to STUDIO for new orgs).
 */
export async function resolvePlanTierForOrg(organizationId: string): Promise<PlanTier> {
  const sub = await prisma.stripeSubscription.findUnique({
    where: { organizationId },
    select: { status: true, planTier: true, cancelAtPeriodEnd: true, currentPeriodEnd: true },
  });

  if (sub && ACTIVE_STATUSES.includes(sub.status)) {
    return BILLING_TO_TIER[sub.planTier];
  }

  // Fallback to the legacy admin-set plan
  const settings = await prisma.organizationPortalSettings.findUnique({
    where: { organizationId },
    select: { plan: true },
  });
  return mapPlanToTier(settings?.plan ?? null);
}
