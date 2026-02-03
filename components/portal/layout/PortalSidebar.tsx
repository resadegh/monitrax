/**
 * Phase 32: Portal Sidebar Navigation
 *
 * MODULAR: Sidebar navigation for the portal.
 * Can be easily customized or replaced without affecting other components.
 */

'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { OrganizationSelector } from './OrganizationSelector';

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
  badge?: string | number;
  children?: NavItem[];
}

interface PortalSidebarProps {
  organizationName?: string;
  organizationLogo?: string;
  navigation: NavItem[];
  secondaryNavigation?: NavItem[];
  currentOrgId?: string;
}

export function PortalSidebar({
  organizationName = 'Organization',
  organizationLogo,
  navigation,
  secondaryNavigation,
  currentOrgId,
}: PortalSidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/portal/dashboard') {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col h-screen sticky top-0">
      {/* Organization Selector */}
      <div className="p-2 border-b border-slate-800">
        <OrganizationSelector />
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navigation.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            isActive={isActive(item.href)}
            pathname={pathname}
          />
        ))}
      </nav>

      {/* Secondary Navigation */}
      {secondaryNavigation && secondaryNavigation.length > 0 && (
        <div className="p-3 border-t border-slate-800 space-y-1">
          {secondaryNavigation.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              isActive={isActive(item.href)}
              pathname={pathname}
            />
          ))}
        </div>
      )}

      {/* User/Help Section */}
      <div className="p-3 border-t border-slate-800">
        <Link
          href="/portal/settings"
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
            isActive('/portal/settings')
              ? 'bg-slate-800 text-white'
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <SettingsIcon />
          <span>Settings</span>
        </Link>
        <Link
          href="/"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition-colors mt-1"
        >
          <ExitIcon />
          <span>Exit Portal</span>
        </Link>
      </div>
    </aside>
  );
}

/**
 * Navigation Link Component
 */
function NavLink({
  item,
  isActive,
  pathname,
}: {
  item: NavItem;
  isActive: boolean;
  pathname: string;
}) {
  const hasChildren = item.children && item.children.length > 0;
  const isChildActive = hasChildren
    ? item.children?.some((child) => pathname.startsWith(child.href)) ?? false
    : false;

  return (
    <div>
      <Link
        href={item.href}
        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
          isActive || isChildActive
            ? 'bg-slate-800 text-white'
            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
        }`}
      >
        <span className="w-5 h-5 flex-shrink-0">{item.icon}</span>
        <span className="flex-1">{item.label}</span>
        {item.badge !== undefined && (
          <span className="px-2 py-0.5 text-xs bg-slate-700 rounded-full">
            {item.badge}
          </span>
        )}
      </Link>

      {/* Child Navigation */}
      {hasChildren && (isActive || isChildActive) && (
        <div className="ml-8 mt-1 space-y-1">
          {item.children?.map((child) => (
            <Link
              key={child.href}
              href={child.href}
              className={`block px-3 py-1.5 rounded-lg text-sm transition-colors ${
                pathname === child.href
                  ? 'text-white'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {child.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// Icons
function SettingsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function ExitIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}

// Export icon components for use in navigation config
export const NavIcons = {
  Dashboard: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
    </svg>
  ),
  Clients: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  Team: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  Tasks: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  Integrations: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  ),
  ApiKeys: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
    </svg>
  ),
  Reports: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  Billing: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  ),
};
