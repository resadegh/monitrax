/**
 * Phase 32: Enterprise Portal Layout
 *
 * Root layout for the Enterprise Portal.
 * This layout is completely separate from the main app layout.
 */

import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Monitrax Portal',
  description: 'Enterprise Portal for Financial Advisors and Accountants',
};

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Portal-specific layout wrapper */}
      {children}
    </div>
  );
}
