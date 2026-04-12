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
const FULL_WIDTH_PAGES = ['/admin/login', '/admin'];

interface AdminContext {
  adminId: string;
  email: string;
  name: string;
  role: AdminRole;
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
          });
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
  }, [isFullWidthPage, router]);

  // For full-width pages (login), render without sidebar
  if (isFullWidthPage) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {children}
      </div>
    );
  }

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  // Not authenticated — will redirect via useEffect
  if (!adminContext) {
    return null;
  }

  // Main layout with sidebar
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      <AdminSidebar
        role={adminContext.role}
        adminName={adminContext.name}
        adminEmail={adminContext.email}
      />
      <main className="flex-1 p-6 overflow-auto">
        {children}
      </main>
    </div>
  );
}
