/**
 * Phase 32: Client Components Index
 *
 * MODULAR: Export all client-related components.
 */

export { ClientList } from './ClientList';
export type { ClientFilters } from './ClientList';

// Phase 32B PR3 — drill-in canonical client view + adviser overlay.
// Replaces the retired `ClientDetail.tsx` (deleted in this PR; flagged in
// IMPLEMENTATION_PLAN.md Dead Code). The drill-in renders the canonical
// consumer dashboard via `getMasterFinancialSnapshot()` with a viewerContext
// instead of a separate client-detail layout — see
// `app/portal/clients/[id]/view/page.tsx`.
export { ClientCanonicalDashboard } from './ClientCanonicalDashboard';
export { AdviserOverlay } from './AdviserOverlay';

export {
  ClientStatusBadge,
  ConsentBadge,
  TaskStatusBadge,
  TaskPriorityBadge,
  ScopeBadge,
  ScopeList,
} from './ClientBadges';
