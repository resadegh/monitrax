/**
 * Phase 32: Enterprise Portal Layout
 *
 * Root layout for the Enterprise Portal.
 * This layout is completely separate from the main app layout.
 *
 * MODULAR: Uses PortalLayoutClient for navigation which can be
 * customized per organization without affecting other layouts.
 */

import { Metadata } from 'next';
import { PortalLayoutClient } from './PortalLayoutClient';

export const metadata: Metadata = {
  title: 'Monitrax Portal',
  description: 'Enterprise Portal for Financial Advisors and Accountants',
};

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PortalLayoutClient>{children}</PortalLayoutClient>;
}
