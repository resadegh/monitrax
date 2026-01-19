/**
 * Phase 32: Client Badge Components
 *
 * MODULAR: Status badges for clients.
 * Can be used anywhere client status needs to be displayed.
 */

'use client';

import type { ClientStatus, ConsentStatus, ClientTaskStatus, ClientTaskPriority } from '@prisma/client';

interface BadgeProps {
  className?: string;
}

// ============================================================================
// CLIENT STATUS BADGE
// ============================================================================

interface ClientStatusBadgeProps extends BadgeProps {
  status: ClientStatus;
}

const clientStatusConfig: Record<ClientStatus, { label: string; className: string }> = {
  INVITED: {
    label: 'Invited',
    className: 'bg-blue-100 text-blue-700',
  },
  PENDING: {
    label: 'Pending',
    className: 'bg-amber-100 text-amber-700',
  },
  ACTIVE: {
    label: 'Active',
    className: 'bg-emerald-100 text-emerald-700',
  },
  SUSPENDED: {
    label: 'Suspended',
    className: 'bg-red-100 text-red-700',
  },
  ARCHIVED: {
    label: 'Archived',
    className: 'bg-slate-100 text-slate-500',
  },
};

export function ClientStatusBadge({ status, className = '' }: ClientStatusBadgeProps) {
  const config = clientStatusConfig[status];

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${config.className} ${className}`}
    >
      {config.label}
    </span>
  );
}

// ============================================================================
// CONSENT STATUS BADGE
// ============================================================================

interface ConsentBadgeProps extends BadgeProps {
  status: ConsentStatus;
  expiresAt?: string | null;
}

const consentStatusConfig: Record<ConsentStatus, { label: string; className: string; icon?: string }> = {
  PENDING: {
    label: 'Pending',
    className: 'bg-amber-100 text-amber-700',
    icon: '⏳',
  },
  GRANTED: {
    label: 'Granted',
    className: 'bg-emerald-100 text-emerald-700',
    icon: '✓',
  },
  REVOKED: {
    label: 'Revoked',
    className: 'bg-red-100 text-red-700',
    icon: '✕',
  },
  EXPIRED: {
    label: 'Expired',
    className: 'bg-slate-100 text-slate-500',
    icon: '⚠',
  },
};

export function ConsentBadge({ status, expiresAt, className = '' }: ConsentBadgeProps) {
  const config = consentStatusConfig[status];

  // Check if consent is about to expire (within 30 days)
  const isExpiringSoon = expiresAt && status === 'GRANTED' && (() => {
    const expiry = new Date(expiresAt);
    const now = new Date();
    const daysUntilExpiry = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  })();

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${
        isExpiringSoon ? 'bg-amber-100 text-amber-700' : config.className
      } ${className}`}
      title={expiresAt ? `Expires: ${new Date(expiresAt).toLocaleDateString()}` : undefined}
    >
      {config.icon && <span>{config.icon}</span>}
      {isExpiringSoon ? 'Expiring Soon' : config.label}
    </span>
  );
}

// ============================================================================
// TASK STATUS BADGE
// ============================================================================

interface TaskStatusBadgeProps extends BadgeProps {
  status: ClientTaskStatus;
}

const taskStatusConfig: Record<ClientTaskStatus, { label: string; className: string }> = {
  TODO: {
    label: 'To Do',
    className: 'bg-slate-100 text-slate-600',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    className: 'bg-blue-100 text-blue-700',
  },
  WAITING: {
    label: 'Waiting',
    className: 'bg-amber-100 text-amber-700',
  },
  COMPLETED: {
    label: 'Completed',
    className: 'bg-emerald-100 text-emerald-700',
  },
  CANCELLED: {
    label: 'Cancelled',
    className: 'bg-slate-100 text-slate-400',
  },
};

export function TaskStatusBadge({ status, className = '' }: TaskStatusBadgeProps) {
  const config = taskStatusConfig[status];

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${config.className} ${className}`}
    >
      {config.label}
    </span>
  );
}

// ============================================================================
// TASK PRIORITY BADGE
// ============================================================================

interface TaskPriorityBadgeProps extends BadgeProps {
  priority: ClientTaskPriority;
}

const taskPriorityConfig: Record<ClientTaskPriority, { label: string; className: string }> = {
  LOW: {
    label: 'Low',
    className: 'bg-slate-100 text-slate-600',
  },
  MEDIUM: {
    label: 'Medium',
    className: 'bg-blue-100 text-blue-700',
  },
  HIGH: {
    label: 'High',
    className: 'bg-amber-100 text-amber-700',
  },
  URGENT: {
    label: 'Urgent',
    className: 'bg-red-100 text-red-700',
  },
};

export function TaskPriorityBadge({ priority, className = '' }: TaskPriorityBadgeProps) {
  const config = taskPriorityConfig[priority];

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${config.className} ${className}`}
    >
      {config.label}
    </span>
  );
}

// ============================================================================
// DATA SCOPE BADGES
// ============================================================================

import type { DataAccessScope } from '@prisma/client';

interface ScopeBadgeProps extends BadgeProps {
  scope: DataAccessScope;
}

const scopeConfig: Record<DataAccessScope, { label: string; shortLabel: string }> = {
  FULL: { label: 'Full Access', shortLabel: 'Full' },
  FINANCIAL: { label: 'Financial Data', shortLabel: 'Financial' },
  INVESTMENTS: { label: 'Investments', shortLabel: 'Invest' },
  TAX: { label: 'Tax Information', shortLabel: 'Tax' },
  DOCUMENTS: { label: 'Documents', shortLabel: 'Docs' },
  TRANSACTIONS: { label: 'Transactions', shortLabel: 'Trans' },
  PROPERTIES: { label: 'Properties', shortLabel: 'Props' },
  LOANS: { label: 'Loans', shortLabel: 'Loans' },
};

export function ScopeBadge({ scope, className = '' }: ScopeBadgeProps) {
  const config = scopeConfig[scope];

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-slate-100 text-slate-600 ${className}`}
      title={config.label}
    >
      {config.shortLabel}
    </span>
  );
}

interface ScopeListProps {
  scopes: DataAccessScope[];
  maxVisible?: number;
}

export function ScopeList({ scopes, maxVisible = 3 }: ScopeListProps) {
  const visibleScopes = scopes.slice(0, maxVisible);
  const hiddenCount = scopes.length - maxVisible;

  return (
    <div className="flex flex-wrap gap-1">
      {visibleScopes.map((scope) => (
        <ScopeBadge key={scope} scope={scope} />
      ))}
      {hiddenCount > 0 && (
        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-slate-100 text-slate-500">
          +{hiddenCount} more
        </span>
      )}
    </div>
  );
}
