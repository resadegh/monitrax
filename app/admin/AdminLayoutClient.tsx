'use client';

/**
 * Phase M: Admin Portal Layout (Client Component) — GCP Identity Platform
 *
 * Client-side layout with sidebar navigation and Firebase Auth state.
 * Fetches admin context from the session endpoint on mount.
 * Redirects to login if not authenticated.
 *
 * Phase M Migration: Replaced mock admin context with real Firebase Auth
 * session validation via /api/admin/auth/session.
 */

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AdminSidebar } from '@/components/admin/layout/AdminSidebar';
import { getFirebaseAuth } from '@/lib/firebase/config';
import { onAuthStateChanged } from 'firebase/auth';
import type { AdminRole } from '@prisma/client';

// Pages that don't show the sidebar
const FULL_WIDTH_PAGES = ['/admin/login', '/admin', '/admin/mfa-setup'];

interface AdminContext {
  adminId: string;
  email: string;
  name: string;
  role: AdminRole;
  mfaSetupRequired?: boolean;
}

interface AdminLayoutClientProps {
  children: React.ReactNode;
}

export function AdminLayoutClient({ children }: AdminLayoutClientProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [adminContext, setAdminContext] = useState<AdminContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isFullWidthPage = FULL_WIDTH_PAGES.some(
    (page) => pathname === page || pathname.startsWith('/admin/login')
  );

  // Phase M: Global fetch interceptor for admin API routes.
  // Auto-injects Firebase ID token as Authorization: Bearer header on any
  // request to /api/admin/*. This lets all existing admin pages continue
  // using raw fetch() without refactoring — the token is attached
  // transparently at the browser level.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const originalFetch = window.fetch;
    window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

      // Only intercept admin API calls
      if (url && url.includes('/api/admin/') && !url.includes('/api/admin/auth/login')) {
        try {
          const auth = getFirebaseAuth();
          const currentUser = auth?.currentUser;
          if (currentUser) {
            const idToken = await currentUser.getIdToken();
            const headers = new Headers(init?.headers || {});
            if (!headers.has('Authorization')) {
              headers.set('Authorization', `Bearer ${idToken}`);
            }
            return originalFetch(input, { ...init, headers });
          }
        } catch {
          // Fall through to original fetch if token fetch fails
        }
      }

      return originalFetch(input, init);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  useEffect(() => {
    // Skip auth check for login page
    if (isFullWidthPage) {
      setIsLoading(false);
      return;
    }

    const auth = getFirebaseAuth();
    if (!auth) {
      setIsLoading(false);
      router.push('/admin/login');
      return;
    }

    // Listen for Firebase auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAdminContext(null);
        setIsLoading(false);
        router.push('/admin/login');
        return;
      }

      try {
        // Verify admin access via our API
        const idToken = await user.getIdToken();
        const response = await fetch('/api/admin/auth/session', {
          headers: { 'Authorization': `Bearer ${idToken}` },
        });

        if (!response.ok) {
          setAdminContext(null);
          router.push('/admin/login');
          return;
        }

        const data = await response.json();
        if (data.valid && data.admin) {
          setAdminContext({
            adminId: data.admin.id,
            email: data.admin.email,
            name: data.admin.name,
            role: data.admin.role,
            mfaSetupRequired: data.mfaSetupRequired === true,
          });

          // Phase M: MFA enrollment wall — redirect privileged admins
          // without MFA to the setup page. They cannot access any other
          // admin routes until MFA is enrolled.
          if (
            data.mfaSetupRequired === true &&
            pathname !== '/admin/mfa-setup' &&
            pathname !== '/admin/login'
          ) {
            router.push('/admin/mfa-setup');
            return;
          }
        } else {
          router.push('/admin/login');
        }
      } catch {
        router.push('/admin/login');
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [isFullWidthPage, router, pathname]);

  // For full-width pages (login), render without sidebar
  if (isFullWidthPage) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 dark:from-[#0A0F1C] dark:via-[#0A0F1C] dark:to-[#0F1929]">
        {children}
      </div>
    );
  }

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0A0F1C] flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  // Not authenticated — will redirect via useEffect
  if (!adminContext) {
    return null;
  }

  // Main layout with sidebar
  return <AdminLayoutWithSidebar adminContext={adminContext}>{children}</AdminLayoutWithSidebar>;
}

/**
 * Inner shell that owns the mobile-drawer state. Split out from the
 * auth-gating logic above so the `useState` hook only mounts once we know
 * the user is authenticated and the sidebar is going to render — avoids
 * a stray hook running during the loading/redirect branches.
 */
function AdminLayoutWithSidebar({
  adminContext,
  children,
}: {
  adminContext: AdminContext;
  children: React.ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#070B14] lg:flex">
      {/* Mobile top bar — hidden at lg+ where the persistent sidebar makes
          the brand visible already. Houses the hamburger that opens the
          drawer + the brand wordmark. */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center gap-3 h-14 px-4 bg-[#0A0F1C] border-b border-white/[0.06]">
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open navigation"
          className="p-2 -ml-2 rounded-md text-gray-300 hover:text-white hover:bg-white/[0.06]"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xs">M</span>
          </div>
          <span className="font-semibold text-sm text-white">Admin Portal</span>
        </div>
      </header>

      {/* Mobile backdrop */}
      {mobileNavOpen && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-slate-900/60 backdrop-blur-sm"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}

      <AdminSidebar
        role={adminContext.role}
        adminName={adminContext.name}
        adminEmail={adminContext.email}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />
      <main className="flex-1 overflow-auto">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
