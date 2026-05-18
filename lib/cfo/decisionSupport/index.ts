/**
 * Phase 17A-D: Decision Support Module
 * Provides decision-making tools for the CFO Engine
 *
 * **Server-only modules are NOT re-exported here** (Tech Debt #7,
 * resolved 2026-05-18). The barrel pattern `export * from './foo'`
 * — where `foo.ts` imports `@/lib/db` (Prisma) — silently pulls
 * Prisma + Cloud SQL Connector into any client bundle that touches
 * the barrel. See `lib/admin/index.ts` for the longer rationale.
 *
 * Server-only paths consumers MUST import directly:
 *   - `@/lib/cfo/decisionSupport/taxIntegration`         (Prisma)
 *   - `@/lib/cfo/decisionSupport/loanDecisionSupport`    (Prisma)
 *   - `@/lib/cfo/decisionSupport/investmentDecisionSupport` (Prisma)
 *
 * `./propertyDecisionSupport` is pure and stays re-exported.
 */

// Phase 17C: Property Decision Support (pure — no Prisma)
export * from './propertyDecisionSupport';

// NOTE: taxIntegration + loanDecisionSupport + investmentDecisionSupport
// are server-only — see file header above. Import them directly via
// their full path, NOT through this barrel.
