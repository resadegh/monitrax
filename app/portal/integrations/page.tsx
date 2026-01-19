/**
 * Phase 32: Portal Integrations Page
 *
 * Displays accounting integrations for the current organization.
 * Uses modular IntegrationsList component.
 */

'use client';

import { useState, useEffect } from 'react';
import { IntegrationsList } from '@/components/portal/integrations';
import {
  createIntegrationsService,
  type AccountingIntegration,
} from '@/lib/portal/services/integrations';
import type { AccountingProvider } from '@prisma/client';

// TODO: Get from auth context
const MOCK_ORG_ID = 'demo-org-id';

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<AccountingIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectingProvider, setConnectingProvider] = useState<AccountingProvider | null>(null);
  const [syncingProvider, setSyncingProvider] = useState<AccountingProvider | null>(null);

  const integrationsApi = createIntegrationsService(MOCK_ORG_ID);

  useEffect(() => {
    // In production, this would call the API
    // For now, show empty integrations
    setIntegrations([]);
    setLoading(false);
  }, []);

  const handleConnect = async (provider: AccountingProvider) => {
    setConnectingProvider(provider);

    try {
      // Get OAuth URL from API
      const response = await integrationsApi.getAuthUrl(provider);

      if (response.data?.authUrl) {
        // Redirect to OAuth provider
        window.location.href = response.data.authUrl;
      } else {
        // Show error or demo message
        alert(`Connect to ${provider} - This would redirect to OAuth in production`);
      }
    } catch (error) {
      console.error('Failed to get auth URL:', error);
    } finally {
      setConnectingProvider(null);
    }
  };

  const handleDisconnect = async (provider: AccountingProvider) => {
    if (!confirm(`Are you sure you want to disconnect ${provider}? This will stop all syncing.`)) {
      return;
    }

    try {
      await integrationsApi.disconnect(provider);
      // Refresh integrations list
      setIntegrations((prev: AccountingIntegration[]) =>
        prev.map((i: AccountingIntegration) => (i.provider === provider ? { ...i, isConnected: false } : i))
      );
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  const handleSync = async (provider: AccountingProvider) => {
    setSyncingProvider(provider);

    try {
      const response = await integrationsApi.sync(provider);

      if (response.data) {
        // Show sync started message
        console.log('Sync started:', response.data.syncId);
      }
    } catch (error) {
      console.error('Failed to start sync:', error);
    } finally {
      setSyncingProvider(null);
    }
  };

  const handleSettings = (provider: AccountingProvider) => {
    // Navigate to integration settings
    window.location.href = `/portal/integrations/${provider.toLowerCase()}`;
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Integrations</h1>
        <p className="text-slate-500 mt-1">
          Connect your accounting software to sync client data
        </p>
      </div>

      <IntegrationsList
        integrations={integrations}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        onSync={handleSync}
        onSettings={handleSettings}
        loadingProvider={connectingProvider}
        syncingProvider={syncingProvider}
      />
    </div>
  );
}
