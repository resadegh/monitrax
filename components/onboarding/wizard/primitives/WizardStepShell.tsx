'use client';

/**
 * WizardStepShell — Phase 12 PR 3a
 *
 * The outer wrapper that every wizard step uses. Provides the entry
 * animation, the optional header (icon + title + subtitle), and spacing
 * rhythm. Steps should render their content as children — the shell
 * handles everything outside the content area.
 *
 * Usage:
 *   <WizardStepShell
 *     icon={<Home />}
 *     title="Your properties"
 *     subtitle="Add any property you own — we'll track equity and cashflow for each."
 *   >
 *     <WizardSection ...>...</WizardSection>
 *     <WizardSection ...>...</WizardSection>
 *   </WizardStepShell>
 */

import React from 'react';

interface WizardStepShellProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  headerTrailing?: React.ReactNode; // e.g. a step count chip or skip link
  children: React.ReactNode;
}

export function WizardStepShell({
  icon,
  title,
  subtitle,
  headerTrailing,
  children,
}: WizardStepShellProps) {
  return (
    <div className="wz-step-shell space-y-5">
      <header className="wz-step-shell-header">
        {icon && <div className="wz-step-shell-icon">{icon}</div>}
        <h2 className="wz-step-shell-title">{title}</h2>
        {subtitle && <p className="wz-step-shell-subtitle">{subtitle}</p>}
        {headerTrailing && <div className="mt-3 flex justify-center">{headerTrailing}</div>}
      </header>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

export default WizardStepShell;
