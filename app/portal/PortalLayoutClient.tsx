/**
 * Phase 32: Portal Layout Client Component
 *
 * MODULAR: Client-side layout with navigation.
 * Separated from server layout for hydration and state management.
 */

'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { PortalSidebar, NavIcons } from '@/components/portal/layout/PortalSidebar';

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
];

// Pages that should NOT show the sidebar (login, etc.)
const FULL_WIDTH_PAGES = ['/portal/login', '/portal', '/portal/consent'];

export function PortalLayoutClient({ children }: PortalLayoutClientProps) {
  const pathname = usePathname();

  // Check if current page should be full-width (no sidebar)
  const isFullWidthPage = FULL_WIDTH_PAGES.some(
    (page) => pathname === page || pathname?.startsWith('/portal/login') || pathname?.startsWith('/portal/consent')
  );

  if (isFullWidthPage) {
    return (
      <div className="min-h-screen bg-slate-50">
        {children}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar Navigation */}
      <PortalSidebar
        organizationName="Demo Organization"
        navigation={mainNavigation}
        secondaryNavigation={secondaryNavigation}
      />

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}

export default PortalLayoutClient;
