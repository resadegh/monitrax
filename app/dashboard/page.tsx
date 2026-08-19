/**
 * /dashboard root — MODULE_HOME gate (PROD_SIMPLIFICATION_PLAN.md §2.2,
 * §4.4). The Home dashboard is a hidden module in v1: when MODULE_HOME
 * is OFF (the ship default) this page redirects to the app's landing
 * surface, /dashboard/properties — the root is NEVER a 404 (D-4).
 *
 * The pre-existing client Home page moved verbatim to ./HomeClient.tsx;
 * this thin server wrapper only decides redirect-vs-render. Home
 * returns rebuilt at R4, when its feeder modules do.
 */
import { redirect } from 'next/navigation';
import { resolveModuleRouting } from '@/lib/featureFlags/moduleRouteGuard';
import { ModuleOverrideGate } from '@/components/featureFlags/ModuleOverrideGate';
import HomeClient from './HomeClient';

export const dynamic = 'force-dynamic';

export default async function DashboardRootPage() {
  const mode = await resolveModuleRouting('MODULE_HOME');
  if (mode === 'hidden') {
    redirect('/dashboard/properties');
  }
  if (mode === 'enabled') {
    return <HomeClient />;
  }
  // R0 override window: the override holder sees Home; everyone else is
  // client-redirected to /dashboard/properties (the root never 404s, D-4).
  return (
    <ModuleOverrideGate moduleKey="MODULE_HOME" fallbackHref="/dashboard/properties">
      <HomeClient />
    </ModuleOverrideGate>
  );
}
