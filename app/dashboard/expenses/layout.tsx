/**
 * PROD Simplification P1 (PROD_SIMPLIFICATION_PLAN.md §4.4): server-side
 * module gate for this subtree. When MODULE_HOUSEHOLD is OFF (the v1 ship
 * default), every route below renders the app's 404 — nav hiding alone
 * is not enforcement. Hidden ≠ deleted: the module returns via its
 * R-stage gate (plan §5).
 */
import { moduleRouteGuard } from '@/lib/featureFlags/moduleRouteGuard';

export default async function ExpensesListModuleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await moduleRouteGuard('MODULE_HOUSEHOLD');
  return <>{children}</>;
}
