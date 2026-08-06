/**
 * Module Registry — the single source of the PROD-Simplification hide
 * decision (CLAUDE.md §12.2.1 SSOT).
 *
 * Nav filtering, route guards, API guards and the admin Modules panel
 * ALL read this one structure. No second nav source, no per-page
 * hardcoding. `GlobalFeatureFlag` rows hold ONLY the on/off state; this
 * registry holds the meaning of each key.
 *
 * Design rules (PROD_SIMPLIFICATION_PLAN.md §2-§3):
 *   - Only HIDDEN modules get flag keys. Kept surfaces (Properties,
 *     Loans, Assets, Documents/Vault, Intake, Reports, Settings) are
 *     unflagged and unconditional — a DB outage can never hide the
 *     kept app.
 *   - Every key ships `enabled: false` (seed) and the gate fails
 *     CLOSED: flag off/unreadable ⇒ module HIDDEN, which is the
 *     correct v1 state by construction.
 *   - `apiPrefixes` come from the P1.2 audit (final table in the plan
 *     §2.3): an API prefix is gated ONLY if NO kept surface calls it.
 *     Prefixes with kept callers (`tax`, `investments`, `portal`,
 *     `household-*`, `dashboard`, `master-snapshot`) are deliberately
 *     ABSENT here.
 *   - Hidden ≠ deleted. Every module has a named return stage
 *     (plan §5 R-stages); re-enable is an R-stage gate, not a casual
 *     toggle.
 *
 * Where this is used:
 *   - `lib/featureFlags/moduleGate.ts` — server-side enabled checks
 *   - `lib/featureFlags/moduleRouteGuard.ts` — layout 404 / API 503
 *   - `lib/navigation/trailNav.tsx` — `moduleKey` on nav items
 *   - `app/api/feature-flags/modules/route.ts` — public flag map
 *   - `app/admin/feature-flags/page.tsx` — the Modules panel
 *   - `prisma/seed-feature-flags.ts` — seeds every key `enabled:false`
 *
 * @see docs/strategy/PROD_SIMPLIFICATION_PLAN.md §2-§4 (spec of record)
 */

export type ModuleKey =
  | 'MODULE_HOME'
  | 'MODULE_HOUSEHOLD'
  | 'MODULE_DEBT_PLANNER'
  | 'MODULE_SAFETY_NET'
  | 'MODULE_ENTITIES'
  | 'MODULE_INVESTMENTS'
  | 'MODULE_TAX'
  | 'MODULE_CFO'
  | 'MODULE_STRATEGY'
  | 'MODULE_HOUSEKEEPING'
  | 'MODULE_SOCIAL'
  | 'MODULE_LABS'
  | 'MODULE_ORG_PORTAL';

export interface ModuleDef {
  key: ModuleKey;
  /** Admin panel display name. */
  label: string;
  /** Hrefs filtered out of trailNav-rendered nav (sidebar, bottom bar, More sheet). */
  navHrefs: string[];
  /** Page-route prefixes guarded at layout level (notFound / redirect). */
  routePrefixes: string[];
  /** `/api/<prefix>` prefixes guarded with 503 — P1.2 audit outcome only. */
  apiPrefixes: string[];
  /** R-stage at which the module returns (plan §5). Shown in the admin panel. */
  returnStage: 2 | 3 | 4 | 5;
  /** MODULE_HOME only: root page redirects to /dashboard/properties instead of 404. */
  behaviour?: 'redirect';
}

export const MODULE_REGISTRY: readonly ModuleDef[] = [
  {
    key: 'MODULE_HOME',
    label: 'Home dashboard',
    navHrefs: ['/dashboard'],
    routePrefixes: ['/dashboard'], // root page ONLY — enforced via behaviour, never a layout guard
    apiPrefixes: ['money-flow'], // zero callers anywhere (P1.2); the intake Sankey reads /api/master-snapshot
    returnStage: 4,
    behaviour: 'redirect',
  },
  {
    key: 'MODULE_HOUSEHOLD',
    label: 'Household, budget & cashflow',
    navHrefs: ['/dashboard/household-profile', '/cashflow', '/dashboard/plan'],
    routePrefixes: [
      '/dashboard/household-profile',
      '/cashflow',
      '/dashboard/plan',
      '/dashboard/budget-analysis',
      '/dashboard/income',
      '/dashboard/expenses',
    ],
    // household-profile/-members/-pets APIs stay OPEN: the onboarding
    // wizard (kept shell) + OwnershipPicker on kept dialogs call them.
    apiPrefixes: ['cashflow', 'budget', 'budget-analysis'],
    returnStage: 3,
  },
  {
    key: 'MODULE_DEBT_PLANNER',
    label: 'Debt Freedom planner',
    navHrefs: ['/dashboard/debt-planner'],
    routePrefixes: ['/dashboard/debt-planner'],
    apiPrefixes: [], // no /api/debt-planner exists; the page reads /api/budget-analysis (gated above)
    returnStage: 3,
  },
  {
    key: 'MODULE_SAFETY_NET',
    label: 'My Safety Net',
    navHrefs: ['/dashboard/safety-net'],
    routePrefixes: ['/dashboard/safety-net'],
    apiPrefixes: ['safety-net'],
    returnStage: 3,
  },
  {
    key: 'MODULE_ENTITIES',
    label: 'My Structure (entities)',
    navHrefs: ['/dashboard/entities'],
    routePrefixes: ['/dashboard/entities'],
    // wealth-graph's only consumers are Home + the entities page (both
    // hidden). If MODULE_HOME returns before MODULE_ENTITIES, revisit.
    apiPrefixes: ['wealth-graph'],
    returnStage: 5,
  },
  {
    key: 'MODULE_INVESTMENTS',
    label: 'Investments & Superannuation',
    navHrefs: ['/dashboard/investments/accounts', '/dashboard/investments/super'],
    routePrefixes: ['/dashboard/investments'],
    // /api/investments stays OPEN: account pickers on kept dialogs
    // (ExpenseDialog, TransferDestinationSheet, CreateExpenseFromRecurring)
    // and the onboarding wizard call it.
    apiPrefixes: [],
    returnStage: 5,
  },
  {
    key: 'MODULE_TAX',
    label: 'Tax module',
    navHrefs: ['/dashboard/tax'],
    routePrefixes: ['/dashboard/tax'],
    // /api/tax stays OPEN: the onboarding wizard writes /api/tax/super.
    // Reports never fetch /api/tax — they import tax lib code directly.
    apiPrefixes: [],
    returnStage: 2,
  },
  {
    key: 'MODULE_CFO',
    label: 'My Guide (CFO, What-If, Ask)',
    navHrefs: ['/dashboard/cfo'],
    routePrefixes: ['/dashboard/cfo'],
    // financial-health has ZERO fetch callers anywhere (P1.2) — gated
    // here with its Guide-family siblings.
    apiPrefixes: ['cfo', 'ai-advisor', 'financial-health'],
    returnStage: 4,
  },
  {
    key: 'MODULE_STRATEGY',
    label: 'Strategy (pages + per-item tabs)',
    navHrefs: [],
    routePrefixes: [
      '/strategy',
      '/dashboard/properties/[id]/strategy',
      '/dashboard/loans/[id]/strategy',
      '/dashboard/investments/holdings/[id]/strategy',
    ],
    // Gated because its only kept-surface callers are the per-item
    // strategy tabs, which this same key hides client-side.
    apiPrefixes: ['strategy'],
    returnStage: 4,
  },
  {
    key: 'MODULE_HOUSEKEEPING',
    label: 'Housekeeping',
    navHrefs: ['/dashboard/housekeeping/tax'],
    routePrefixes: ['/dashboard/housekeeping'],
    apiPrefixes: [],
    returnStage: 2,
  },
  {
    key: 'MODULE_SOCIAL',
    label: 'Conversations, Requests & Marketplace',
    navHrefs: [],
    // /marketplace added by the P1.2 audit: its pages' only API
    // (/api/marketplace, /api/ask-a-pro) is gated here, so the pages
    // must hide with it or they render against 503s.
    routePrefixes: ['/dashboard/conversations', '/dashboard/requests', '/marketplace'],
    apiPrefixes: ['conversations', 'professional-requests', 'ask-a-pro', 'marketplace'],
    returnStage: 5,
  },
  {
    key: 'MODULE_LABS',
    label: 'Labs',
    navHrefs: [],
    routePrefixes: ['/dashboard/labs'],
    apiPrefixes: [],
    returnStage: 5,
  },
  {
    key: 'MODULE_ORG_PORTAL',
    label: 'Org Portal',
    navHrefs: [],
    routePrefixes: ['/portal'],
    // /api/portal stays OPEN: the FeedbackChatDrawer in the kept
    // dashboard shell calls /api/portal/feedback*.
    apiPrefixes: [],
    returnStage: 5,
  },
];

export const MODULE_KEYS: readonly ModuleKey[] = MODULE_REGISTRY.map((m) => m.key);

export function getModuleDef(key: ModuleKey): ModuleDef {
  // MODULE_REGISTRY is exhaustive over ModuleKey by construction.
  return MODULE_REGISTRY.find((m) => m.key === key)!;
}

export function isModuleKey(key: string): key is ModuleKey {
  return (MODULE_KEYS as readonly string[]).includes(key);
}
