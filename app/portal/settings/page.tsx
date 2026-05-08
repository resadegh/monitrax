'use client';

/**
 * Org Portal Settings (Settings overhaul 2026-05-08)
 *
 * Mounts the previously-orphaned `<OrganizationSettings />` component
 * (components/portal/settings/OrganizationSettings.tsx) on a real
 * route. PortalSidebar.tsx already has the link gated behind the
 * `organizationManagement` feature flag — flipping that flag now
 * surfaces a working settings page instead of a 404.
 *
 * Reuses GET / PATCH /api/portal/organizations/[orgId] — no new
 * server logic. Phase 32B PR2/PR3 lighthouse-adviser pitch needs this
 * surface; the IMPLEMENTATION_PLAN row 0a A1-A4 propagation swept
 * every Org Portal page except Settings.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { useOrganization } from '@/lib/portal';
import { OrganizationSettings } from '@/components/portal/settings/OrganizationSettings';
import { PortalCard } from '@/components/portal/ui/PortalCard';
import { Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface OrganizationDetail {
  organization: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
  };
  portalSettings: {
    organizationType?: string;
    plan?: string;
    brandName?: string | null;
    brandLogoUrl?: string | null;
    brandPrimaryColor?: string | null;
    brandSecondaryColor?: string | null;
    businessEmail?: string | null;
    businessPhone?: string | null;
    businessAddress?: string | null;
    abn?: string | null;
    acn?: string | null;
    afslNumber?: string | null;
    taxAgentNumber?: string | null;
  } | null;
}

export default function PortalSettingsPage() {
  const { token } = useAuth();
  const { currentOrg } = useOrganization();
  const [detail, setDetail] = useState<OrganizationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !currentOrg?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/portal/organizations/${currentOrg.id}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (!response.ok) {
          const result = await response.json().catch(() => ({}));
          throw new Error(result.message || 'Failed to load organisation');
        }
        const data = await response.json();
        if (!cancelled) setDetail(data);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, currentOrg?.id]);

  const handleSave = async (data: Record<string, unknown>) => {
    if (!token || !currentOrg?.id) return;
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(
        `/api/portal/organizations/${currentOrg.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(data),
        }
      );
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.message || 'Failed to save settings');
      }
      const updated = await response.json();
      setDetail({
        organization: updated.organization,
        portalSettings: updated.portalSettings,
      });
      setSuccess('Settings saved');
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
      throw err;
    }
  };

  if (!currentOrg) {
    return (
      <div className="p-6">
        <PortalCard>
          <div className="text-center py-8">
            <p className="text-sm text-slate-600">
              Select an organisation to manage its settings.
            </p>
          </div>
        </PortalCard>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error && !detail) {
    return (
      <div className="p-6">
        <PortalCard>
          <div className="flex items-center gap-3 text-red-600 py-4">
            <AlertTriangle className="h-5 w-5" />
            <p className="text-sm">{error}</p>
          </div>
        </PortalCard>
      </div>
    );
  }

  if (!detail) {
    return null;
  }

  const initialData = {
    name: detail.organization.name,
    slug: detail.organization.slug,
    description: detail.organization.description || '',
    organizationType: (detail.portalSettings?.organizationType ||
      'ACCOUNTING_FIRM') as never,
    plan: (detail.portalSettings?.plan || 'STARTER') as never,
    businessEmail: detail.portalSettings?.businessEmail || '',
    businessPhone: detail.portalSettings?.businessPhone || '',
    businessAddress: detail.portalSettings?.businessAddress || '',
    abn: detail.portalSettings?.abn || '',
    acn: detail.portalSettings?.acn || '',
    afslNumber: detail.portalSettings?.afslNumber || '',
    taxAgentNumber: detail.portalSettings?.taxAgentNumber || '',
    brandName: detail.portalSettings?.brandName || '',
    brandLogoUrl: detail.portalSettings?.brandLogoUrl || '',
    brandPrimaryColor: detail.portalSettings?.brandPrimaryColor || '#1e293b',
    brandSecondaryColor:
      detail.portalSettings?.brandSecondaryColor || '#3b82f6',
  };

  // Plan-gated white-labelling — keep parity with Phase 32 plan matrix.
  // STARTER + PROFESSIONAL hide the branding block; BUSINESS +
  // ENTERPRISE expose it.
  const planLimits = {
    whiteLabeling:
      detail.portalSettings?.plan === 'BUSINESS' ||
      detail.portalSettings?.plan === 'ENTERPRISE',
    customDomains: detail.portalSettings?.plan === 'ENTERPRISE',
    ssoSaml: detail.portalSettings?.plan === 'ENTERPRISE',
  };

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">
          Organisation settings
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Manage {detail.organization.name}'s public information, business
          registration, and (where your plan allows) client-facing branding.
        </p>
      </div>

      {success && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 flex items-center gap-2 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          {success}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 flex items-center gap-2 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}

      <OrganizationSettings
        initialData={initialData}
        onSave={handleSave}
        planLimits={planLimits}
      />
    </div>
  );
}
