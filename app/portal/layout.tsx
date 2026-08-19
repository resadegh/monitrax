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
import ModuleGateBoundary from '@/components/featureFlags/ModuleGateBoundary';

export const metadata: Metadata = {
  title: 'Monitrax Portal',
  description: 'Enterprise Portal for Financial Advisors and Accountants',
};

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // PROD Simplification (plan §4.4 + R0): the Org Portal is a hidden
  // module in v1 (MODULE_ORG_PORTAL, returns at R5 as its own product
  // decision). /api/portal/* stays open — the in-app FeedbackChatDrawer
  // depends on /api/portal/feedback (P1.2 audit).
  return (
    <ModuleGateBoundary moduleKey="MODULE_ORG_PORTAL">
      <PortalLayoutClient>{children}</PortalLayoutClient>
    </ModuleGateBoundary>
  );
}
