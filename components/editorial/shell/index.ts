/**
 * Editorial shell barrel — desktop sidebar + topbar + mobile bottom nav
 * + AppShell wrapper for the Restrained Editorial dashboard.
 *
 * Composition:
 *   EditorialAppShell
 *     ├── EditorialSidebar  (md+ only, hidden on mobile)
 *     ├── EditorialTopBar   (responsive — 56px mobile, 64px desktop)
 *     └── EditorialBottomNav (mobile only, hidden on md+)
 *
 * Shared building block:
 *   EditorialNavRow — used by Sidebar + the future mobile drawer
 *
 * Stitch references:
 *   - Desktop shell: 2543c8240b944c8fa6b6e89d20ac8e77
 *   - Mobile shell:  dc038cd19aea4cfc8d0300f4d9122ffd
 *
 * Consumer migration (the existing `DashboardLayout.tsx` swap) is
 * deferred to a follow-up phase so this PR ships safe primitives only.
 */

export { EditorialNavRow } from './EditorialNavRow';
export type { EditorialNavRowProps } from './EditorialNavRow';

export { EditorialSidebar } from './EditorialSidebar';
export type { EditorialSidebarProps } from './EditorialSidebar';

export { EditorialTopBar } from './EditorialTopBar';
export type { EditorialTopBarProps } from './EditorialTopBar';

export { EditorialBottomNav } from './EditorialBottomNav';
export type { EditorialBottomNavProps } from './EditorialBottomNav';

export { EditorialAppShell } from './EditorialAppShell';
export type { EditorialAppShellProps } from './EditorialAppShell';
