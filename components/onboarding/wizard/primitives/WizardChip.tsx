'use client';

/**
 * WizardChip — Phase 12 PR 3a
 *
 * Small pill used for time estimates, step labels, inline tags, and
 * status indicators. Comes in blue / green / amber variants matching
 * the welcome modal's existing chip styles.
 */

import React from 'react';

interface WizardChipProps {
  children: React.ReactNode;
  color?: 'blue' | 'green' | 'amber';
  icon?: React.ReactNode;
  className?: string;
}

export function WizardChip({
  children,
  color = 'blue',
  icon,
  className = '',
}: WizardChipProps) {
  return (
    <span className={`wz-chip wz-chip-${color} ${className}`}>
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
}

export default WizardChip;
