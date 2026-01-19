/**
 * Phase 32: Integration Card Component
 *
 * MODULAR: Display card for each accounting integration.
 * Shows connection status and allows connect/disconnect actions.
 */

'use client';

import { PortalCard } from '../ui/PortalCard';
import { PortalButton } from '../ui/PortalButton';
import type { AccountingProvider, IntegrationSyncStatus } from '@prisma/client';

interface IntegrationCardProps {
  provider: AccountingProvider;
  isConnected: boolean;
  providerOrganization?: string | null;
  lastSyncAt?: string | null;
  lastSyncStatus?: IntegrationSyncStatus | null;
  lastSyncError?: string | null;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onSync?: () => void;
  onSettings?: () => void;
  loading?: boolean;
  syncLoading?: boolean;
}

const providerConfig: Record<AccountingProvider, {
  name: string;
  description: string;
  logo: string;
  color: string;
  available: boolean;
}> = {
  XERO: {
    name: 'Xero',
    description: 'Connect to Xero to sync client data with your practice',
    logo: '/integrations/xero-logo.svg',
    color: '#13B5EA',
    available: true,
  },
  MYOB: {
    name: 'MYOB',
    description: 'Connect to MYOB AccountRight or Essentials',
    logo: '/integrations/myob-logo.svg',
    color: '#6B2D91',
    available: false,
  },
  QUICKBOOKS: {
    name: 'QuickBooks',
    description: 'Connect to QuickBooks Online',
    logo: '/integrations/qb-logo.svg',
    color: '#2CA01C',
    available: false,
  },
  SAGE: {
    name: 'Sage',
    description: 'Connect to Sage Business Cloud',
    logo: '/integrations/sage-logo.svg',
    color: '#00D639',
    available: false,
  },
  FRESHBOOKS: {
    name: 'FreshBooks',
    description: 'Connect to FreshBooks',
    logo: '/integrations/freshbooks-logo.svg',
    color: '#0075DD',
    available: false,
  },
  WAVE: {
    name: 'Wave',
    description: 'Connect to Wave Accounting',
    logo: '/integrations/wave-logo.svg',
    color: '#1E88E5',
    available: false,
  },
  OTHER: {
    name: 'Other',
    description: 'Generic accounting software integration',
    logo: '/integrations/generic-logo.svg',
    color: '#6B7280',
    available: false,
  },
};

const syncStatusConfig: Record<IntegrationSyncStatus, { label: string; className: string }> = {
  PENDING: { label: 'Pending', className: 'bg-slate-100 text-slate-600' },
  IN_PROGRESS: { label: 'Syncing...', className: 'bg-blue-100 text-blue-700' },
  COMPLETED: { label: 'Synced', className: 'bg-emerald-100 text-emerald-700' },
  FAILED: { label: 'Failed', className: 'bg-red-100 text-red-700' },
  PARTIAL: { label: 'Partial', className: 'bg-amber-100 text-amber-700' },
};

export function IntegrationCard({
  provider,
  isConnected,
  providerOrganization,
  lastSyncAt,
  lastSyncStatus,
  lastSyncError,
  onConnect,
  onDisconnect,
  onSync,
  onSettings,
  loading = false,
  syncLoading = false,
}: IntegrationCardProps) {
  const config = providerConfig[provider];

  return (
    <PortalCard className="relative overflow-hidden">
      {/* Accent bar */}
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ backgroundColor: isConnected ? config.color : '#E2E8F0' }}
      />

      <div className="flex items-start gap-4 pt-2">
        {/* Logo */}
        <div
          className="w-12 h-12 rounded-lg flex items-center justify-center text-white text-xl font-bold"
          style={{ backgroundColor: config.color }}
        >
          {config.name.charAt(0)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-slate-900">{config.name}</h3>
              {isConnected && providerOrganization ? (
                <p className="text-sm text-slate-600">{providerOrganization}</p>
              ) : (
                <p className="text-sm text-slate-500">{config.description}</p>
              )}
            </div>

            {/* Status Badge */}
            {isConnected ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Connected
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-500">
                Not Connected
              </span>
            )}
          </div>

          {/* Sync Status */}
          {isConnected && (
            <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
              {lastSyncAt && (
                <span>Last sync: {formatRelativeTime(lastSyncAt)}</span>
              )}
              {lastSyncStatus && (
                <span className={`px-1.5 py-0.5 rounded ${syncStatusConfig[lastSyncStatus].className}`}>
                  {syncStatusConfig[lastSyncStatus].label}
                </span>
              )}
              {lastSyncError && lastSyncStatus === 'FAILED' && (
                <span className="text-red-600" title={lastSyncError}>
                  Error
                </span>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="mt-4 flex items-center gap-2">
            {!isConnected ? (
              config.available ? (
                <PortalButton
                  onClick={onConnect}
                  loading={loading}
                  disabled={loading}
                >
                  Connect
                </PortalButton>
              ) : (
                <span className="text-sm text-slate-400">Coming Soon</span>
              )
            ) : (
              <>
                <PortalButton
                  variant="outline"
                  size="sm"
                  onClick={onSync}
                  loading={syncLoading}
                  disabled={syncLoading}
                >
                  {syncLoading ? 'Syncing...' : 'Sync Now'}
                </PortalButton>
                <PortalButton
                  variant="ghost"
                  size="sm"
                  onClick={onSettings}
                >
                  Settings
                </PortalButton>
                <PortalButton
                  variant="ghost"
                  size="sm"
                  onClick={onDisconnect}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  Disconnect
                </PortalButton>
              </>
            )}
          </div>
        </div>
      </div>
    </PortalCard>
  );
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

export default IntegrationCard;
