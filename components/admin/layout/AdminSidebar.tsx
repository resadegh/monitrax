'use client';

/**
 * Phase M: Admin Sidebar — GCP-Aligned Navigation
 *
 * Organized into 5 clear sections reflecting the admin's actual
 * responsibilities now that GCP services are integrated:
 *
 *   1. Overview — platform dashboard
 *   2. Business Management — Monitrax business logic (no GCP equivalent)
 *   3. GCP Infrastructure — direct GCP API integrations
 *   4. Compliance & Security — CDR + audit + security monitoring
 *   5. Operations — support tools + admin settings
 *
 * Design: modern, minimal, generous whitespace, soft borders.
 */

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase/config';
import { cn } from '@/lib/utils';
import { ADMIN_ROUTES } from '@/lib/admin/constants';
import type { AdminRole } from '@prisma/client';
import { getFeatureAccess } from '@/lib/admin/permissions';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  permission?: keyof ReturnType<typeof getFeatureAccess>;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

// ============================================
// ICON COMPONENTS — consistent 20px stroke icons
// ============================================

const Icon = ({ children }: { children: React.ReactNode }) => (
  <svg className="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    {children}
  </svg>
);

const icons = {
  dashboard: <Icon><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></Icon>,
  organizations: <Icon><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" /></Icon>,
  users: <Icon><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></Icon>,
  billing: <Icon><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></Icon>,
  analytics: <Icon><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></Icon>,
  featureFlags: <Icon><path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" /></Icon>,
  uptime: <Icon><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" /></Icon>,
  errors: <Icon><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></Icon>,
  scheduler: <Icon><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></Icon>,
  security: <Icon><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></Icon>,
  cdr: <Icon><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></Icon>,
  audit: <Icon><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></Icon>,
  shield: <Icon><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" /></Icon>,
  support: <Icon><path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" /></Icon>,
  settings: <Icon><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></Icon>,
  logout: <Icon><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" /></Icon>,
  feedback: <Icon><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></Icon>,
  neomatrix: <Icon><path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" /></Icon>,
  neoaudit: <Icon><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></Icon>,
  calcAudit: <Icon><path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" /></Icon>,
};

// ============================================
// NAVIGATION STRUCTURE
// ============================================

const navSections: NavSection[] = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', href: ADMIN_ROUTES.DASHBOARD, icon: icons.dashboard, permission: 'dashboard' },
    ],
  },
  {
    label: 'Business Management',
    items: [
      { label: 'Organizations', href: ADMIN_ROUTES.ORGANIZATIONS, icon: icons.organizations, permission: 'organizations' },
      { label: 'Users', href: ADMIN_ROUTES.USERS, icon: icons.users, permission: 'users' },
      { label: 'Billing', href: ADMIN_ROUTES.BILLING, icon: icons.billing, permission: 'billing' },
      { label: 'Analytics', href: ADMIN_ROUTES.ANALYTICS, icon: icons.analytics, permission: 'analytics' },
      { label: 'AI Usage & Cost', href: ADMIN_ROUTES.AI_USAGE, icon: icons.analytics, permission: 'analytics' },
      { label: 'Feature Flags', href: ADMIN_ROUTES.FEATURE_FLAGS, icon: icons.featureFlags, permission: 'featureFlags' },
    ],
  },
  {
    label: 'GCP Infrastructure',
    items: [
      { label: 'Uptime & Alerts', href: '/admin/uptime', icon: icons.uptime, permission: 'audit' },
      { label: 'Error Tracking', href: '/admin/errors', icon: icons.errors, permission: 'support' },
      { label: 'Cloud Scheduler', href: '/admin/scheduler', icon: icons.scheduler, permission: 'audit' },
      { label: 'Security Findings', href: '/admin/security-findings', icon: icons.shield, permission: 'audit' },
    ],
  },
  {
    label: 'Compliance & Security',
    items: [
      { label: 'CDR Compliance', href: '/admin/cdr-compliance', icon: icons.cdr, permission: 'audit' },
      { label: 'Audit Logs', href: '/admin/audit-logs', icon: icons.audit, permission: 'audit' },
      { label: 'Security Monitoring', href: '/admin/security', icon: icons.security, permission: 'audit' },
    ],
  },
  {
    label: 'Engineering',
    items: [
      { label: 'NeoAudit', href: '/admin/neoaudit', icon: icons.neoaudit, permission: 'audit' },
      { label: 'Neomatrix', href: '/admin/neomatrix', icon: icons.neomatrix, permission: 'audit' },
      { label: 'Calc Audit', href: '/admin/calc-audit', icon: icons.calcAudit, permission: 'audit' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Adviser Feedback', href: '/admin/feedback', icon: icons.feedback, permission: 'support' },
      { label: 'Support Tools', href: ADMIN_ROUTES.SUPPORT, icon: icons.support, permission: 'support' },
      { label: 'Settings', href: ADMIN_ROUTES.SETTINGS, icon: icons.settings, permission: 'admins' },
    ],
  },
];

interface AdminSidebarProps {
  role: AdminRole;
  adminName: string;
  adminEmail: string;
  /**
   * Mobile drawer state. At `lg` breakpoint (≥1024px) the sidebar is always
   * visible and these props are ignored. Below `lg` the sidebar slides in
   * from the left when `mobileOpen` is true and slides out otherwise.
   */
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function AdminSidebar({
  role,
  adminName,
  adminEmail,
  mobileOpen = false,
  onMobileClose,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const access = getFeatureAccess(role);

  // Auto-close the drawer on route change.
  useEffect(() => {
    if (mobileOpen && onMobileClose) {
      onMobileClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const handleLogout = async () => {
    try {
      const auth = getFirebaseAuth();
      if (auth) {
        await signOut(auth);
      }
    } catch (err) {
      console.error('Logout error:', err);
    }
    router.push('/admin/login');
  };

  const isActive = (href: string) => {
    if (href === ADMIN_ROUTES.DASHBOARD) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  const filterByAccess = (items: NavItem[]) => {
    return items.filter((item) => {
      if (!item.permission) return true;
      const permValue = access[item.permission];
      if (typeof permValue === 'boolean') return permValue;
      if (typeof permValue === 'object' && 'read' in permValue) return permValue.read;
      return true;
    });
  };

  return (
    <aside
      className={cn(
        // Layout — fixed slide-in drawer below lg, persistent column at lg+
        'fixed inset-y-0 left-0 z-40 w-[260px] lg:sticky lg:top-0 lg:z-auto',
        'min-h-screen flex flex-col',
        'bg-[#0A0F1C] text-gray-300 border-r border-white/[0.06]',
        'transform transition-transform duration-200 ease-out',
        'lg:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}
      aria-label="Admin navigation"
    >
      {/* Brand Header — also houses the mobile close button at <lg */}
      <div className="px-5 pt-6 pb-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <span className="text-white font-bold text-sm">M</span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-sm text-white tracking-tight">Monitrax</h1>
            <p className="text-[11px] text-gray-500 font-medium">Admin Portal</p>
          </div>
          <button
            type="button"
            onClick={onMobileClose}
            aria-label="Close navigation"
            className="lg:hidden p-1.5 -mr-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/[0.06]"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {navSections.map((section, sectionIdx) => {
          const visibleItems = filterByAccess(section.items);
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.label} className={cn(sectionIdx > 0 && 'mt-6')}>
              <p className="px-3 text-[10px] font-semibold text-gray-500 uppercase tracking-[0.18em] mb-2">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'group flex items-center gap-3 px-3 py-[9px] rounded-lg text-[13px] font-medium transition-all duration-150',
                        active
                          ? 'bg-white/[0.08] text-white shadow-sm'
                          : 'text-gray-400 hover:bg-white/[0.04] hover:text-white'
                      )}
                    >
                      <span
                        className={cn(
                          'transition-colors',
                          active ? 'text-blue-400' : 'text-gray-500 group-hover:text-gray-300'
                        )}
                      >
                        {item.icon}
                      </span>
                      {item.label}
                      {active && (
                        <span className="ml-auto w-1 h-1 rounded-full bg-blue-400" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User Section */}
      <div className="px-3 py-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/[0.04] transition-colors">
          <div className="w-8 h-8 bg-gradient-to-br from-gray-700 to-gray-800 rounded-full flex items-center justify-center ring-1 ring-white/10">
            <span className="text-xs font-semibold text-white">
              {adminName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-white truncate">{adminName}</p>
            <p className="text-[11px] text-gray-500 truncate">{adminEmail}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 text-gray-500 hover:text-white rounded-md hover:bg-white/[0.06] transition-colors"
            title="Sign out"
            aria-label="Sign out"
          >
            {icons.logout}
          </button>
        </div>
      </div>
    </aside>
  );
}
