/**
 * ModuleGateBoundary — the server-side module gate every hidden-module
 * layout renders through (R0 evolution of the P1 `moduleRouteGuard`;
 * PROD_SIMPLIFICATION_PLAN.md §4.4 + §5 R0).
 *
 * Three modes (resolved by `resolveModuleRouting`, which also carries
 * the MON-160 dynamic-rendering opt-out):
 *   enabled          → render for everyone (global flag ON)
 *   hidden           → hard server 404 (the v1 ship default)
 *   override-window  → ≥1 active per-user override exists while the
 *                      global flag is OFF: render the shell, and let
 *                      the CLIENT gate decide per-user — the override
 *                      holder sees the module; everyone else gets the
 *                      app's not-found page. Every gated API call is
 *                      additionally user-aware server-side.
 *
 * Server layouts cannot know the user (Bearer-token auth only), which
 * is why the per-user half of the decision is client-rendered during
 * override windows. Outside a window the server 404 is absolute.
 */

import { notFound } from 'next/navigation';
import { resolveModuleRouting } from '@/lib/featureFlags/moduleRouteGuard';
import type { ModuleKey } from '@/lib/featureFlags/moduleRegistry';
import { ModuleOverrideGate } from './ModuleOverrideGate';

export default async function ModuleGateBoundary({
  moduleKey,
  fallbackHref,
  children,
}: {
  moduleKey: ModuleKey;
  /** MODULE_HOME only: redirect here instead of rendering not-found. */
  fallbackHref?: string;
  children: React.ReactNode;
}) {
  const mode = await resolveModuleRouting(moduleKey);
  if (mode === 'enabled') {
    return <>{children}</>;
  }
  if (mode === 'hidden') {
    notFound();
  }
  return (
    <ModuleOverrideGate moduleKey={moduleKey} fallbackHref={fallbackHref}>
      {children}
    </ModuleOverrideGate>
  );
}
