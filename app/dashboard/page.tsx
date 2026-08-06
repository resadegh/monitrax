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
import { isModuleEnabled } from '@/lib/featureFlags/moduleGate';
import HomeClient from './HomeClient';

export const dynamic = 'force-dynamic';

export default async function DashboardRootPage() {
  const homeEnabled = await isModuleEnabled('MODULE_HOME');
  if (!homeEnabled) {
    redirect('/dashboard/properties');
  }
  return <HomeClient />;
}
