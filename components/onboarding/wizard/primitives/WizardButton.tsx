'use client';

/**
 * WizardButton primitives — Phase 12 PR 3a
 *
 * Three button variants used consistently across the wizard:
 *
 *   - <WizardPrimaryButton>  — gradient CTA for the main action
 *   - <WizardGhostButton>    — bordered secondary action
 *   - <WizardAddButton>      — dashed-border "+ Add another" action
 *
 * All three forward ref and accept standard button props. Styles live
 * in `styles/wizard-animations.css` under the PR 3a design tokens.
 */

import React, { forwardRef } from 'react';

type BaseBtnProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

interface WizardPrimaryButtonProps extends BaseBtnProps {
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
}

export const WizardPrimaryButton = forwardRef<HTMLButtonElement, WizardPrimaryButtonProps>(
  function WizardPrimaryButton(
    { children, leadingIcon, trailingIcon, className = '', type = 'button', ...rest },
    ref
  ) {
    return (
      <button ref={ref} type={type} className={`wz-btn-primary ${className}`} {...rest}>
        {leadingIcon && <span className="flex-shrink-0">{leadingIcon}</span>}
        <span>{children}</span>
        {trailingIcon && <span className="flex-shrink-0">{trailingIcon}</span>}
      </button>
    );
  }
);

interface WizardGhostButtonProps extends BaseBtnProps {
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
}

export const WizardGhostButton = forwardRef<HTMLButtonElement, WizardGhostButtonProps>(
  function WizardGhostButton(
    { children, leadingIcon, trailingIcon, className = '', type = 'button', ...rest },
    ref
  ) {
    return (
      <button ref={ref} type={type} className={`wz-btn-ghost ${className}`} {...rest}>
        {leadingIcon && <span className="flex-shrink-0">{leadingIcon}</span>}
        <span>{children}</span>
        {trailingIcon && <span className="flex-shrink-0">{trailingIcon}</span>}
      </button>
    );
  }
);

interface WizardAddButtonProps extends BaseBtnProps {
  leadingIcon?: React.ReactNode;
}

export const WizardAddButton = forwardRef<HTMLButtonElement, WizardAddButtonProps>(
  function WizardAddButton(
    { children, leadingIcon, className = '', type = 'button', ...rest },
    ref
  ) {
    return (
      <button ref={ref} type={type} className={`wz-btn-add ${className}`} {...rest}>
        {leadingIcon && <span className="flex-shrink-0">{leadingIcon}</span>}
        <span>{children}</span>
      </button>
    );
  }
);
