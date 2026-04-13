'use client';

/**
 * WizardSection — Phase 12 PR 3a
 *
 * A labeled content card used inside wizard steps to group related
 * fields. Has an optional icon, title, description, and trailing
 * action slot (e.g. an "Add" button or a toggle). Children render
 * inside the body.
 *
 * Typical usage inside a step:
 *   <WizardSection
 *     icon={<Receipt />}
 *     iconClassName="bg-amber-100 text-amber-600"
 *     title="Property expenses"
 *     description="Rates, strata, insurance — approximate is fine."
 *     trailing={<button onClick={addExpense}>+ Add</button>}
 *   >
 *     {items.map(...)}
 *   </WizardSection>
 */

import React from 'react';

interface WizardSectionProps {
  icon?: React.ReactNode;
  iconClassName?: string;
  title: string;
  description?: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function WizardSection({
  icon,
  iconClassName = 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400',
  title,
  description,
  trailing,
  children,
  className = '',
}: WizardSectionProps) {
  return (
    <section className={`wz-section ${className}`}>
      <div className="wz-section-header">
        <div className="wz-section-title-wrap">
          {icon && <div className={`wz-section-icon ${iconClassName}`}>{icon}</div>}
          <div className="min-w-0">
            <h3 className="wz-section-title">{title}</h3>
            {description && <p className="wz-section-description">{description}</p>}
          </div>
        </div>
        {trailing && <div className="flex-shrink-0">{trailing}</div>}
      </div>
      <div>{children}</div>
    </section>
  );
}

export default WizardSection;
