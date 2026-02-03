'use client';

/**
 * Phase 33: Admin Badge Component
 *
 * Reusable badge/status indicator component for the admin portal.
 */

import React from 'react';
import { cn } from '@/lib/utils';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'neutral';
type BadgeSize = 'sm' | 'md' | 'lg';

interface AdminBadgeProps {
  children?: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  success: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  neutral: 'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

const dotColors: Record<BadgeVariant, string> = {
  default: 'bg-gray-500',
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  error: 'bg-red-500',
  info: 'bg-blue-500',
  neutral: 'bg-gray-400',
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
  lg: 'px-3 py-1.5 text-sm',
};

export function AdminBadge({
  children,
  variant = 'default',
  size = 'md',
  dot,
  className,
}: AdminBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {dot && (
        <span
          className={cn('w-1.5 h-1.5 rounded-full mr-1.5', dotColors[variant])}
        />
      )}
      {children}
    </span>
  );
}

/**
 * Status badge with predefined states
 */
interface StatusBadgeProps {
  status: 'active' | 'inactive' | 'pending' | 'suspended' | 'cancelled' | 'error';
  size?: BadgeSize;
  className?: string;
}

const statusConfig: Record<StatusBadgeProps['status'], { label: string; variant: BadgeVariant }> = {
  active: { label: 'Active', variant: 'success' },
  inactive: { label: 'Inactive', variant: 'neutral' },
  pending: { label: 'Pending', variant: 'warning' },
  suspended: { label: 'Suspended', variant: 'error' },
  cancelled: { label: 'Cancelled', variant: 'error' },
  error: { label: 'Error', variant: 'error' },
};

export function StatusBadge({ status, size = 'md', className }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <AdminBadge variant={config.variant} size={size} dot className={className}>
      {config.label}
    </AdminBadge>
  );
}

/**
 * Tier badge for user/organization tiers
 */
interface TierBadgeProps {
  tier: string;
  size?: BadgeSize;
  className?: string;
}

const tierVariants: Record<string, BadgeVariant> = {
  FREE: 'neutral',
  BASIC: 'default',
  PRO: 'info',
  PREMIUM: 'success',
  STARTER: 'neutral',
  PROFESSIONAL: 'info',
  BUSINESS: 'success',
  ENTERPRISE: 'warning',
};

export function TierBadge({ tier, size = 'md', className }: TierBadgeProps) {
  const variant = tierVariants[tier] || 'default';
  return (
    <AdminBadge variant={variant} size={size} className={className}>
      {tier}
    </AdminBadge>
  );
}

/**
 * Role badge for admin roles
 */
interface RoleBadgeProps {
  role: string;
  size?: BadgeSize;
  className?: string;
}

const roleVariants: Record<string, BadgeVariant> = {
  SUPER_ADMIN: 'error',
  BILLING_ADMIN: 'warning',
  SUPPORT_ADMIN: 'info',
  VIEWER: 'neutral',
};

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  BILLING_ADMIN: 'Billing Admin',
  SUPPORT_ADMIN: 'Support Admin',
  VIEWER: 'Viewer',
};

export function RoleBadge({ role, size = 'md', className }: RoleBadgeProps) {
  const variant = roleVariants[role] || 'default';
  const label = roleLabels[role] || role;
  return (
    <AdminBadge variant={variant} size={size} className={className}>
      {label}
    </AdminBadge>
  );
}

/**
 * Count badge (typically shown on icons)
 */
interface CountBadgeProps {
  count: number;
  max?: number;
  className?: string;
}

export function CountBadge({ count, max = 99, className }: CountBadgeProps) {
  const displayCount = count > max ? `${max}+` : count.toString();

  if (count === 0) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-xs font-bold text-white bg-red-500 rounded-full',
        className
      )}
    >
      {displayCount}
    </span>
  );
}
