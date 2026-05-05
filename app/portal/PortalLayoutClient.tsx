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

import { ReactNode, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import { OrganizationProvider, useOrganization } from '@/lib/portal';
import { PortalSidebar, NavIcons } from '@/components/portal/layout/PortalSidebar';
import { HelpDrawerButton } from '@/components/help/HelpDrawerButton';

interface PortalLayoutClientProps {
  children: ReactNode;
}

// Navigation configuration - easily customizable
const mainNavigation = [
  {
    label: 'Dashboard',
    href: '/portal/dashboard',
    icon: <NavIcons.Dashboard />,
  },
  {
    label: 'Clients',
    href: '/portal/clients',
    icon: <NavIcons.Clients />,
  },
  {
    label: 'Team',
    href: '/portal/team',
    icon: <NavIcons.Team />,
  },
  {
    label: 'Tasks',
    href: '/portal/tasks',
    icon: <NavIcons.Tasks />,
  },
  {
    label: 'Integrations',
    href: '/portal/integrations',
    icon: <NavIcons.Integrations />,
  },
];

const secondaryNavigation = [
  {
    label: 'API Keys',
    href: '/portal/api-keys',
    icon: <NavIcons.ApiKeys />,
  },
  {
    label: 'Reports',
    href: '/portal/reports',
    icon: <NavIcons.Reports />,
  },
  {
    label: 'Feedback',
    href: '/portal/feedback',
    icon: <NavIcons.Feedback />,
  },
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
    <div className="flex min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Sidebar Navigation */}
      <PortalSidebar
        organizationName={currentOrg?.name || 'Select Organization'}
        navigation={mainNavigation}
        secondaryNavigation={secondaryNavigation}
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
