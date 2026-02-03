/**
 * Phase 32: Portal Button Components
 *
 * MODULAR: Button components for the portal with consistent styling.
 */

'use client';

import { ReactNode, ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface PortalButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-slate-900 text-white hover:bg-slate-800 focus:ring-slate-500',
  secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200 focus:ring-slate-500',
  outline: 'bg-white text-slate-900 border border-slate-200 hover:bg-slate-50 focus:ring-slate-500',
  ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 focus:ring-slate-500',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export function PortalButton({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  disabled,
  children,
  className = '',
  ...props
}: PortalButtonProps) {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <button
      className={`
        ${baseClasses}
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <LoadingSpinner size={size} />
          <span className="ml-2">{children}</span>
        </>
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <span className="mr-2 -ml-0.5">{icon}</span>
          )}
          {children}
          {icon && iconPosition === 'right' && (
            <span className="ml-2 -mr-0.5">{icon}</span>
          )}
        </>
      )}
    </button>
  );
}

/**
 * Icon Button Component
 */
interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  label: string; // Required for accessibility
}

export function IconButton({
  icon,
  variant = 'ghost',
  size = 'md',
  label,
  className = '',
  ...props
}: IconButtonProps) {
  const sizeIconClasses = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-11 h-11',
  };

  return (
    <button
      className={`
        ${variantClasses[variant]}
        ${sizeIconClasses[size]}
        inline-flex items-center justify-center rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
      aria-label={label}
      title={label}
      {...props}
    >
      {icon}
    </button>
  );
}

/**
 * Button Group Component
 */
interface ButtonGroupProps {
  children: ReactNode;
  className?: string;
}

export function ButtonGroup({ children, className = '' }: ButtonGroupProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {children}
    </div>
  );
}

/**
 * Loading Spinner Component
 */
function LoadingSpinner({ size }: { size: ButtonSize }) {
  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <svg
      className={`animate-spin ${sizeClasses[size]}`}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

/**
 * Dropdown Button Component
 */
interface DropdownButtonProps {
  label: ReactNode;
  items: Array<{
    label: string;
    onClick: () => void;
    icon?: ReactNode;
    danger?: boolean;
    disabled?: boolean;
  }>;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function DropdownButton({
  label,
  items,
  variant = 'outline',
  size = 'md',
}: DropdownButtonProps) {
  return (
    <div className="relative inline-block">
      <PortalButton variant={variant} size={size}>
        {label}
        <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </PortalButton>
      {/* Dropdown menu would be shown on click - requires state management */}
    </div>
  );
}

/**
 * Link Button (styled as button but renders anchor)
 */
interface LinkButtonProps {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
  className?: string;
  external?: boolean;
}

export function LinkButton({
  href,
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  external = false,
}: LinkButtonProps) {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';

  return (
    <a
      href={href}
      className={`
        ${baseClasses}
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {children}
      {external && (
        <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      )}
    </a>
  );
}
