/**
 * PROD Simplification (plan §4.4 + §5 R0): server-side module gate for
 * this subtree, via the shared ModuleGateBoundary — global ON renders,
 * fully hidden 404s (the v1 default), and during an R0 override window
 * the per-user verdict is enforced client-side + at every gated API.
 * Carries the MON-160 dynamic-rendering opt-out. Hidden ≠ deleted: the
 * module returns via its R-stage gate (plan §5).
 */
import ModuleGateBoundary from '@/components/featureFlags/ModuleGateBoundary';

export default async function PlanModuleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ModuleGateBoundary moduleKey="MODULE_HOUSEHOLD">{children}</ModuleGateBoundary>;
}
