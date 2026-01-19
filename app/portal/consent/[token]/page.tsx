/**
 * Phase 32: Consent Request Page
 *
 * Displayed to clients when they click a consent request link.
 * Allows them to approve or deny access to their data.
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ConsentRequest } from '@/components/portal/consent';
import { PortalCard, EmptyState } from '@/components/portal/ui/PortalCard';
import type { DataAccessScope } from '@prisma/client';

interface ConsentData {
  organizationName: string;
  organizationLogo: string | null;
  organizationType: string;
  requestedScopes: DataAccessScope[];
  personalMessage: string | null;
  requestedByName: string | null;
  expiryDays: number;
  status: 'pending' | 'expired' | 'used' | 'invalid';
}

export default function ConsentPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [consentData, setConsentData] = useState<ConsentData | null>(null);
  const [completed, setCompleted] = useState(false);
  const [result, setResult] = useState<'approved' | 'denied' | null>(null);

  useEffect(() => {
    // In production, this would validate the token and fetch consent request details
    // For now, show demo data
    const loadConsentRequest = async () => {
      try {
        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Demo data
        setConsentData({
          organizationName: 'Demo Accounting Firm',
          organizationLogo: null,
          organizationType: 'Accounting Firm',
          requestedScopes: ['FINANCIAL', 'TRANSACTIONS', 'TAX', 'DOCUMENTS'],
          personalMessage: "Hi! We'd like to access your financial data to help with your tax planning this year. Please review and approve the access request.",
          requestedByName: 'John Smith',
          expiryDays: 365,
          status: 'pending',
        });
      } catch (err) {
        setError('Failed to load consent request');
      } finally {
        setLoading(false);
      }
    };

    loadConsentRequest();
  }, [token]);

  const handleApprove = async (approvedScopes: DataAccessScope[]) => {
    // In production, this would call the API to approve consent
    console.log('Approved scopes:', approvedScopes);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setCompleted(true);
    setResult('approved');
  };

  const handleDeny = async () => {
    // In production, this would call the API to deny consent
    console.log('Consent denied');
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setCompleted(true);
    setResult('denied');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin mx-auto" />
          <p className="text-slate-500 mt-4">Loading consent request...</p>
        </div>
      </div>
    );
  }

  if (error || !consentData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <PortalCard className="max-w-md w-full text-center">
          <EmptyState
            icon={<ErrorIcon />}
            title="Invalid Request"
            description={error || 'This consent request is no longer valid or has expired.'}
          />
        </PortalCard>
      </div>
    );
  }

  if (consentData.status === 'expired') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <PortalCard className="max-w-md w-full text-center">
          <EmptyState
            icon={<ExpiredIcon />}
            title="Request Expired"
            description="This consent request has expired. Please contact your advisor to send a new request."
          />
        </PortalCard>
      </div>
    );
  }

  if (consentData.status === 'used') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <PortalCard className="max-w-md w-full text-center">
          <EmptyState
            icon={<CheckIcon />}
            title="Already Responded"
            description="You have already responded to this consent request."
          />
        </PortalCard>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <PortalCard className="max-w-md w-full text-center py-8">
          <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4 ${
            result === 'approved' ? 'bg-emerald-100' : 'bg-slate-100'
          }`}>
            {result === 'approved' ? <CheckIcon /> : <DenyIcon />}
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            {result === 'approved' ? 'Access Granted' : 'Access Denied'}
          </h2>
          <p className="text-slate-600 mb-6">
            {result === 'approved'
              ? `${consentData.organizationName} now has access to your selected financial data.`
              : `${consentData.organizationName} will not have access to your data.`}
          </p>
          <a
            href="/dashboard"
            className="inline-flex items-center justify-center px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            Go to Dashboard
          </a>
        </PortalCard>
      </div>
    );
  }

  return (
    <ConsentRequest
      organizationName={consentData.organizationName}
      organizationLogo={consentData.organizationLogo}
      organizationType={consentData.organizationType}
      requestedScopes={consentData.requestedScopes}
      personalMessage={consentData.personalMessage}
      requestedByName={consentData.requestedByName}
      expiryDays={consentData.expiryDays}
      onApprove={handleApprove}
      onDeny={handleDeny}
    />
  );
}

// Icons
function ErrorIcon() {
  return (
    <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function ExpiredIcon() {
  return (
    <svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function DenyIcon() {
  return (
    <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
