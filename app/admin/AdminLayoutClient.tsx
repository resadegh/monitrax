'use client';

/**
 * Phase 33: Admin Portal Layout (Client Component)
 *
 * Client-side layout with sidebar navigation and auth state.
 */

import React from 'react';
import { usePathname } from 'next/navigation';
import { AdminSidebar } from '@/components/admin/layout/AdminSidebar';

// Pages that don't show the sidebar
const FULL_WIDTH_PAGES = ['/admin/login', '/admin'];

// Mock admin context - in production this would come from auth
const mockAdminContext = {
  adminId: 'admin-1',
  email: 'admin@monitrax.com',
  name: 'Admin User',
  role: 'SUPER_ADMIN' as const,
};

interface AdminLayoutClientProps {
  children: React.ReactNode;
}

export function AdminLayoutClient({ children }: AdminLayoutClientProps) {
  const pathname = usePathname();
  const isFullWidthPage = FULL_WIDTH_PAGES.some(
    (page) => pathname === page || pathname.startsWith('/admin/login')
  );

  // For full-width pages (login), render without sidebar
  if (isFullWidthPage) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {children}
      </div>
    );
  }

  // Main layout with sidebar
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      <AdminSidebar
        role={mockAdminContext.role}
        adminName={mockAdminContext.name}
        adminEmail={mockAdminContext.email}
      />
      <main className="flex-1 p-6 overflow-auto">
        {children}
      </main>
    </div>
  );
}
