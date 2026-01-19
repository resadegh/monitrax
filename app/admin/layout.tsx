/**
 * Phase 33: Admin Portal Layout (Server Component)
 *
 * Root layout for the admin portal.
 */

import type { Metadata } from 'next';
import { AdminLayoutClient } from './AdminLayoutClient';

export const metadata: Metadata = {
  title: 'Admin Portal | Monitrax',
  description: 'Monitrax Staff Admin Portal - Manage users, organizations, and billing',
  robots: 'noindex, nofollow', // Admin portal should not be indexed
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
