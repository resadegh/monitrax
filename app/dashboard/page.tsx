/**
 * /dashboard root — MODULE_HOME gate (PROD_SIMPLIFICATION_PLAN.md §2.2,
 * §4.4) rendering the M3.4 v1 SCOREBOARD (D-16/D-19).
 *
 * When MODULE_HOME is OFF (the ship default) this page redirects to the
 * app's landing surface, /dashboard/properties — the root is NEVER a 404
 * (D-4). When Reza flips MODULE_HOME at M3 acceptance, the root renders
 * ScoreboardClient — the NEW client composed from kept engines via the
 * D-19 tile registry (lib/dashboard/tileRegistry.ts).
 *
 * ./HomeClient.tsx (the pre-simplification wealth-OS Home) is deliberately
 * KEPT but unrendered — hidden ≠ deleted; it returns rebuilt at R4 when its
 * feeder modules do (plan M3.4 build rule). Do not delete it and do not
 * lift its widgets into the scoreboard.
 */
import { redirect } from 'next/navigation';
import { resolveModuleRouting } from '@/lib/featureFlags/moduleRouteGuard';
import { ModuleOverrideGate } from '@/components/featureFlags/ModuleOverrideGate';
import ScoreboardClient from './ScoreboardClient';

export const dynamic = 'force-dynamic';

export default async function DashboardRootPage() {
  const mode = await resolveModuleRouting('MODULE_HOME');
  if (mode === 'hidden') {
    redirect('/dashboard/properties');
  }
  if (mode === 'enabled') {
    return <ScoreboardClient />;
  }
  // R0 override window: the override holder sees the scoreboard; everyone
  // else is client-redirected to /dashboard/properties (never a 404, D-4).
  return (
    <ModuleOverrideGate moduleKey="MODULE_HOME" fallbackHref="/dashboard/properties">
      <ScoreboardClient />
    </ModuleOverrideGate>
  );
}
