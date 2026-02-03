/**
 * Phase 32: Enterprise Portal Landing Page
 *
 * This page handles the entry point to the portal.
 * Users will be redirected to login or their organization dashboard.
 */

import { redirect } from 'next/navigation';

export default function PortalPage() {
  // For now, redirect to the placeholder page
  // In full implementation, this will check auth and redirect accordingly
  redirect('/portal/login');
}
