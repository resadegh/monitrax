/**
 * Phase 32: Portal Layout Client Component
 *
 * MODULAR: Client-side layout with navigation.
 * Separated from server layout for hydration and state management.
 *
 * AUTHENTICATION: Uses existing AuthContext from main app.
 * ORGANIZATION: Provides OrganizationContext for organization selection.
 */

'use client';

import { ReactNode, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import { OrganizationProvider, useOrganization } from '@/lib/portal';
import { isPortalFeatureEnabled } from '@/lib/portal/featureFlags';
import { PortalSidebar, NavIcons } from '@/components/portal/layout/PortalSidebar';
import { HelpDrawerButton } from '@/components/help/HelpDrawerButton';

interface PortalLayoutClientProps {
  children: ReactNode;
}

// Navigation configuration. Items behind a `featureFlag` are hidden
// unless the corresponding `PORTAL_*` env var is set to 'true' AND the
// underlying page is implemented. Defaults are all `false` (see
// `lib/portal/featureFlags.ts`) which keeps Tasks / API Keys / Reports /
// Settings out of the sidebar until those phases ship — preventing
// 404 dead-ends in the live demo (CLAUDE.md §0 designer + behaviour
// psychologist lenses: dead nav items cost trust during pitch).
type NavConfigItem = {
  label: string;
  href: string;
  icon: ReactNode;
  featureFlag?: 'advisorTasks' | 'apiKeyManagement' | 'exportReporting';
};

const mainNavigation: NavConfigItem[] = [
  { label: 'Dashboard', href: '/portal/dashboard', icon: <NavIcons.Dashboard /> },
  { label: 'Clients', href: '/portal/clients', icon: <NavIcons.Clients /> },
  { label: 'Team', href: '/portal/team', icon: <NavIcons.Team /> },
  { label: 'Tasks', href: '/portal/tasks', icon: <NavIcons.Tasks />, featureFlag: 'advisorTasks' },
  { label: 'Integrations', href: '/portal/integrations', icon: <NavIcons.Integrations /> },
];

const secondaryNavigation: NavConfigItem[] = [
  { label: 'API Keys', href: '/portal/api-keys', icon: <NavIcons.ApiKeys />, featureFlag: 'apiKeyManagement' },
  { label: 'Reports', href: '/portal/reports', icon: <NavIcons.Reports />, featureFlag: 'exportReporting' },
  { label: 'Feedback', href: '/portal/feedback', icon: <NavIcons.Feedback /> },
];

// Pages that should NOT require authentication
const PUBLIC_PAGES = ['/portal/login', '/portal/signin', '/portal/invite', '/portal/consent', '/portal/request-access', '/portal/register'];

// Pages that should NOT show the sidebar (login, etc.)
const FULL_WIDTH_PAGES = ['/portal/login', '/portal/signin', '/portal/invite', '/portal', '/portal/consent', '/portal/request-access', '/portal/register'];

/**
 * Inner layout component that uses the organization context
 */
function PortalLayoutInner({ children }: PortalLayoutClientProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { currentOrg, isLoading: orgLoading } = useOrganization();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Filter nav items by their feature flag at render time so unbuilt
  // pages (Tasks / API Keys / Reports) disappear from the sidebar
  // entirely until their flag is on. Non-flagged items always show.
  const visibleMainNav = useMemo(
    () => mainNavigation.filter((i) => !i.featureFlag || isPortalFeatureEnabled(i.featureFlag)),
    [],
  );
  const visibleSecondaryNav = useMemo(
    () => secondaryNavigation.filter((i) => !i.featureFlag || isPortalFeatureEnabled(i.featureFlag)),
    [],
  );

  // Check if current page is public (no auth required)
  const isPublicPage = PUBLIC_PAGES.some(
    (page) => pathname === page ||
      pathname?.startsWith('/portal/login') ||
      pathname?.startsWith('/portal/signin') ||
      pathname?.startsWith('/portal/invite') ||
      pathname?.startsWith('/portal/consent') ||
      pathname?.startsWith('/portal/request-access') ||
      pathname?.startsWith('/portal/register')
  );

  // Check if current page should be full-width (no sidebar)
  const isFullWidthPage = FULL_WIDTH_PAGES.some(
    (page) => pathname === page ||
      pathname?.startsWith('/portal/login') ||
      pathname?.startsWith('/portal/signin') ||
      pathname?.startsWith('/portal/invite') ||
      pathname?.startsWith('/portal/consent') ||
      pathname?.startsWith('/portal/request-access') ||
      pathname?.startsWith('/portal/register')
  );

  // Redirect to portal signin if not authenticated and not on a public page
  useEffect(() => {
    if (!isLoading && !user && !isPublicPage) {
      router.push('/portal/signin?redirect=' + encodeURIComponent(pathname || '/portal/dashboard'));
    }
  }, [user, isLoading, isPublicPage, pathname, router]);

  // Show loading state while checking authentication or loading organizations
  if (isLoading || (orgLoading && !isPublicPage && !isFullWidthPage)) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-500 mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  // If not authenticated and not on public page, show nothing (will redirect)
  if (!user && !isPublicPage) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-500 mt-4">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  if (isFullWidthPage) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        {children}
      </div>
    );
  }

  return (
    <div className="lg:flex min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Mobile top bar — hidden at lg+ where the persistent sidebar makes
          the brand visible already. Glass surface matching consumer-app
          vocabulary, brand pill + current org name. */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center gap-3 h-14 px-4 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open navigation"
          className="p-2 -ml-2 rounded-md text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 shadow-sm shadow-sky-500/20">
          <span className="text-[11px] font-bold text-white">M</span>
        </div>
        <span className="font-semibold text-sm text-slate-900 tracking-tight truncate">
          {currentOrg?.name || 'Monitrax Portal'}
        </span>
      </header>

      {/* Mobile backdrop — fades in behind the drawer at <lg. Tapping it
          closes the drawer. */}
      {mobileNavOpen && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Navigation */}
      <PortalSidebar
        organizationName={currentOrg?.name || 'Select Organization'}
        navigation={visibleMainNav}
        secondaryNavigation={visibleSecondaryNav}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>

      {/* Phase 33b — In-app `?` help drawer. Portal users see the org +
          compliance audiences in scope, plus consumer for advisers
          who occasionally explain consumer surfaces to their clients. */}
      <HelpDrawerButton
        audiences={['org-admin', 'org-professional', 'org-client', 'consumer', 'compliance']}
      />
    </div>
  );
}

/**
 * Main layout component that provides the organization context
 */
export function PortalLayoutClient({ children }: PortalLayoutClientProps) {
  return (
    <OrganizationProvider>
      <PortalLayoutInner>{children}</PortalLayoutInner>
    </OrganizationProvider>
  );
}

export default PortalLayoutClient;
