/**
 * Phase 33: Admin Portal Root Page
 *
 * Redirects to login or dashboard based on auth state.
 */

import { redirect } from 'next/navigation';
import { ADMIN_ROUTES } from '@/lib/admin/constants';

export default function AdminPage() {
  // In production, check auth state and redirect accordingly
  // For now, redirect to login
  redirect(ADMIN_ROUTES.LOGIN);
}
