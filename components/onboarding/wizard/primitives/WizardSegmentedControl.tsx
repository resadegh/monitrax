'use client';

/**
 * WizardSegmentedControl — Phase 12 PR 3a
 *
 * Multi-choice control used for small closed enums (profile answers,
 * lifestyle preferences, dining frequency, etc.). Matches the design
 * language of the rest of the wizard: pill-shaped, keyboard accessible,
 * dark-mode native.
 *
 * Usage:
 *   <WizardSegmentedControl
 *     label="How often do you eat out?"
 *     value={freq}
 *     onChange={setFreq}
 *     options={[
 *       { value: 'NEVER',     label: 'Never' },
 *       { value: 'RARELY',    label: 'Rarely' },
 *       { value: 'SOMETIMES', label: 'Sometimes' },
 *       { value: 'OFTEN',     label: 'Often' },
 *     ]}
 *   />
 */

import React from 'react';

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

interface WizardSegmentedControlProps<T extends string> {
  label?: string;
  value: T | null;
  onChange: (value: T) => void;
  options: readonly SegmentedOption<T>[];
  helper?: string;
  name?: string;
  className?: string;
}

export function WizardSegmentedControl<T extends string>({
  label,
  value,
  onChange,
  options,
  helper,
  name,
  className = '',
}: WizardSegmentedControlProps<T>) {
  const groupId = name ? `wz-seg-${name}` : undefined;
  return (
    <div className={`wz-field ${className}`}>
      {label && (
        <span id={groupId} className="wz-field-label">
          {label}
        </span>
      )}
      <div
        role="radiogroup"
        aria-labelledby={groupId}
        className="wz-segmented flex flex-wrap"
      >
        {options.map((opt) => {
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              data-selected={selected}
              onClick={() => onChange(opt.value)}
              className="wz-segmented-option"
              title={opt.description}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {helper && <p className="wz-field-helper">{helper}</p>}
    </div>
  );
}

export default WizardSegmentedControl;
