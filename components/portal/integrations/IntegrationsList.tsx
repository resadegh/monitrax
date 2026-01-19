/**
 * Phase 32: Integrations List Component
 *
 * MODULAR: Displays all available integrations in a grid.
 * Each integration is independent and can be connected separately.
 */

'use client';

import { PortalCard, CardHeader } from '../ui/PortalCard';
import { IntegrationCard } from './IntegrationCard';
import type { AccountingIntegration } from '@/lib/portal/services/integrations';
import type { AccountingProvider } from '@prisma/client';

interface IntegrationsListProps {
  integrations: AccountingIntegration[];
  onConnect?: (provider: AccountingProvider) => void;
  onDisconnect?: (provider: AccountingProvider) => void;
  onSync?: (provider: AccountingProvider) => void;
  onSettings?: (provider: AccountingProvider) => void;
  loadingProvider?: AccountingProvider | null;
  syncingProvider?: AccountingProvider | null;
}

// All supported providers in display order
const ALL_PROVIDERS: AccountingProvider[] = [
  'XERO',
  'MYOB',
  'QUICKBOOKS',
  'SAGE',
  'FRESHBOOKS',
  'WAVE',
];

export function IntegrationsList({
  integrations,
  onConnect,
  onDisconnect,
  onSync,
  onSettings,
  loadingProvider,
  syncingProvider,
}: IntegrationsListProps) {
  // Create a map of connected integrations
  const integrationMap = new Map(
    integrations.map((i) => [i.provider, i])
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <PortalCard>
        <CardHeader
          title="Accounting Integrations"
          description="Connect your accounting software to sync client data automatically. Monitrax is the single source of truth - data flows outbound only."
        />

        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-start gap-3">
            <InfoIcon />
            <div>
              <p className="text-sm font-medium text-blue-900">
                How Integrations Work
              </p>
              <ul className="text-sm text-blue-800 mt-1 space-y-1">
                <li>• Data syncs from Monitrax → Accounting Software (outbound only)</li>
                <li>• Client contacts are mapped to existing records or created new</li>
                <li>• Financial summaries can be exported as invoices or reports</li>
                <li>• No data is imported back to prevent conflicts</li>
              </ul>
            </div>
          </div>
        </div>
      </PortalCard>

      {/* Connected Integrations */}
      {integrations.filter((i) => i.isConnected).length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-slate-500 uppercase mb-3">
            Connected
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {integrations
              .filter((i) => i.isConnected)
              .map((integration) => (
                <IntegrationCard
                  key={integration.provider}
                  provider={integration.provider}
                  isConnected={true}
                  providerOrganization={integration.providerOrganization}
                  lastSyncAt={integration.lastSyncAt}
                  lastSyncStatus={integration.lastSyncStatus}
                  lastSyncError={integration.lastSyncError}
                  onConnect={() => onConnect?.(integration.provider)}
                  onDisconnect={() => onDisconnect?.(integration.provider)}
                  onSync={() => onSync?.(integration.provider)}
                  onSettings={() => onSettings?.(integration.provider)}
                  loading={loadingProvider === integration.provider}
                  syncLoading={syncingProvider === integration.provider}
                />
              ))}
          </div>
        </div>
      )}

      {/* Available Integrations */}
      <div>
        <h3 className="text-sm font-medium text-slate-500 uppercase mb-3">
          Available Integrations
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          {ALL_PROVIDERS.filter((p) => !integrationMap.get(p)?.isConnected).map(
            (provider) => {
              const integration = integrationMap.get(provider);
              return (
                <IntegrationCard
                  key={provider}
                  provider={provider}
                  isConnected={false}
                  onConnect={() => onConnect?.(provider)}
                  loading={loadingProvider === provider}
                />
              );
            }
          )}
        </div>
      </div>

      {/* API Access Info */}
      <PortalCard>
        <CardHeader
          title="API Access"
          description="For advanced integrations, use the Monitrax API"
        />
        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
          <div>
            <p className="text-sm font-medium text-slate-900">
              REST API Available
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Programmatic access to client data with full audit logging
            </p>
          </div>
          <a
            href="/portal/api-keys"
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Manage API Keys →
          </a>
        </div>
      </PortalCard>
    </div>
  );
}

function InfoIcon() {
  return (
    <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

export default IntegrationsList;
