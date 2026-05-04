/**
 * Phase 32: Organization Context
 *
 * Provides organization selection state for the portal.
 * Users must select an organization before accessing organization-specific features.
 */

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/context/AuthContext';

interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  role: string;
  portalEnabled: boolean;
  // Phase 32B PR1: canonical "what kind of firm is this?" — drives Practice
  // dashboard layout, alert library, scope presets, AFSL/credit/TPB framing.
  // Falls back to `organizationType` for orgs created before the migration.
  profession: string | null;
  organizationType: string | null;
  plan: string | null;
  brandName: string | null;
  brandLogoUrl: string | null;
  memberCount: number;
  clientCount: number;
  joinedAt: string | null;
  createdAt: string;
}

interface OrganizationContextType {
  organizations: Organization[];
  currentOrg: Organization | null;
  isLoading: boolean;
  error: string | null;
  selectOrganization: (orgId: string) => void;
  refreshOrganizations: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

const SELECTED_ORG_KEY = 'portal_selected_org_id';

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const { user, token, isLoading: authLoading } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrganizations = useCallback(async () => {
    if (!token) {
      setOrganizations([]);
      setCurrentOrg(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/portal/organizations', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch organizations');
      }

      const data = await response.json();
      setOrganizations(data.organizations || []);

      // Restore previously selected organization
      const savedOrgId = localStorage.getItem(SELECTED_ORG_KEY);
      if (savedOrgId) {
        const savedOrg = data.organizations?.find((org: Organization) => org.id === savedOrgId);
        if (savedOrg) {
          setCurrentOrg(savedOrg);
        } else if (data.organizations?.length > 0) {
          // If saved org not found, select first one
          setCurrentOrg(data.organizations[0]);
          localStorage.setItem(SELECTED_ORG_KEY, data.organizations[0].id);
        }
      } else if (data.organizations?.length > 0) {
        // Auto-select first organization if none selected
        setCurrentOrg(data.organizations[0]);
        localStorage.setItem(SELECTED_ORG_KEY, data.organizations[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch organizations');
      console.error('[Portal] Error fetching organizations:', err);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!authLoading && user && token) {
      fetchOrganizations();
    } else if (!authLoading && !user) {
      setOrganizations([]);
      setCurrentOrg(null);
      setIsLoading(false);
    }
  }, [authLoading, user, token, fetchOrganizations]);

  const selectOrganization = useCallback((orgId: string) => {
    const org = organizations.find((o) => o.id === orgId);
    if (org) {
      setCurrentOrg(org);
      localStorage.setItem(SELECTED_ORG_KEY, orgId);
    }
  }, [organizations]);

  const refreshOrganizations = useCallback(async () => {
    await fetchOrganizations();
  }, [fetchOrganizations]);

  return (
    <OrganizationContext.Provider
      value={{
        organizations,
        currentOrg,
        isLoading,
        error,
        selectOrganization,
        refreshOrganizations,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
}

export type { Organization };
