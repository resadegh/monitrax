/**
 * Phase 32: Consent Request Component
 *
 * MODULAR: Displayed to clients when an organization requests access to their data.
 * Shows what data access is being requested and allows approve/deny.
 */

'use client';

import { useState } from 'react';
import { PortalCard } from '../ui/PortalCard';
import { PortalButton, ButtonGroup } from '../ui/PortalButton';
import { Checkbox, FormGroup } from '../ui/PortalForm';
import { ScopeBadge } from '../clients/ClientBadges';
import type { DataAccessScope } from '@prisma/client';

interface ConsentRequestProps {
  organizationName: string;
  organizationLogo?: string | null;
  organizationType: string;
  requestedScopes: DataAccessScope[];
  personalMessage?: string | null;
  requestedByName?: string;
  expiryDays?: number;
  onApprove: (approvedScopes: DataAccessScope[]) => Promise<void>;
  onDeny: () => Promise<void>;
  loading?: boolean;
}

const scopeDetails: Record<DataAccessScope, {
  label: string;
  description: string;
  examples: string[];
}> = {
  FULL: {
    label: 'Full Access',
    description: 'Complete access to all your financial data',
    examples: ['All accounts', 'All transactions', 'All documents', 'Tax information'],
  },
  FINANCIAL: {
    label: 'Financial Overview',
    description: 'Your account balances and financial summary',
    examples: ['Bank account balances', 'Credit card balances', 'Net worth'],
  },
  TRANSACTIONS: {
    label: 'Transaction History',
    description: 'Your transaction records and spending patterns',
    examples: ['Income transactions', 'Expense transactions', 'Transfers'],
  },
  INVESTMENTS: {
    label: 'Investment Data',
    description: 'Your investment accounts and holdings',
    examples: ['Share holdings', 'Superannuation', 'Managed funds'],
  },
  TAX: {
    label: 'Tax Information',
    description: 'Data relevant for tax preparation',
    examples: ['Deductions', 'Tax estimates', 'Superannuation contributions'],
  },
  PROPERTIES: {
    label: 'Property Information',
    description: 'Your property portfolio details',
    examples: ['Property values', 'Addresses', 'Rental income'],
  },
  LOANS: {
    label: 'Loan Details',
    description: 'Your loan and mortgage information',
    examples: ['Loan balances', 'Interest rates', 'Repayment schedules'],
  },
  DOCUMENTS: {
    label: 'Documents',
    description: 'Access to your uploaded documents',
    examples: ['Receipts', 'Statements', 'Tax documents'],
  },
};

export function ConsentRequest({
  organizationName,
  organizationLogo,
  organizationType,
  requestedScopes,
  personalMessage,
  requestedByName,
  expiryDays = 365,
  onApprove,
  onDeny,
  loading = false,
}: ConsentRequestProps) {
  const [approvedScopes, setApprovedScopes] = useState<DataAccessScope[]>(requestedScopes);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<'review' | 'confirm'>('review');

  const handleScopeToggle = (scope: DataAccessScope) => {
    setApprovedScopes((prev) => {
      if (prev.includes(scope)) {
        return prev.filter((s) => s !== scope);
      }
      return [...prev, scope];
    });
  };

  const handleApprove = async () => {
    if (step === 'review') {
      setStep('confirm');
      return;
    }

    setSubmitting(true);
    try {
      await onApprove(approvedScopes);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeny = async () => {
    setSubmitting(true);
    try {
      await onDeny();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-xl w-full">
        <PortalCard className="overflow-hidden">
          {/* Header */}
          <div className="bg-slate-900 -mx-6 -mt-6 px-6 py-8 mb-6">
            <div className="flex items-center gap-4">
              {organizationLogo ? (
                <img
                  src={organizationLogo}
                  alt={organizationName}
                  className="w-16 h-16 rounded-xl bg-white object-cover"
                />
              ) : (
                <div className="w-16 h-16 bg-slate-700 rounded-xl flex items-center justify-center text-2xl font-bold text-white">
                  {organizationName.charAt(0)}
                </div>
              )}
              <div className="text-white">
                <h1 className="text-xl font-bold">{organizationName}</h1>
                <p className="text-slate-300 text-sm">{organizationType}</p>
              </div>
            </div>
          </div>

          {step === 'review' && (
            <>
              {/* Request Message */}
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-2">
                  {requestedByName || organizationName} is requesting access to your financial data
                </h2>
                <p className="text-slate-600">
                  Review the requested access below. You can modify which data you want to share.
                </p>
                {personalMessage && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
                    <p className="text-sm text-blue-800 italic">"{personalMessage}"</p>
                    <p className="text-xs text-blue-600 mt-2">— {requestedByName || 'Your advisor'}</p>
                  </div>
                )}
              </div>

              {/* Scope Selection */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-slate-700 mb-3">
                  Requested Access
                </h3>
                <FormGroup className="space-y-3">
                  {requestedScopes.map((scope) => {
                    const details = scopeDetails[scope];
                    const isApproved = approvedScopes.includes(scope);

                    return (
                      <div
                        key={scope}
                        className={`p-4 rounded-lg border transition-colors ${
                          isApproved
                            ? 'bg-emerald-50 border-emerald-200'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            label=""
                            checked={isApproved}
                            onChange={() => handleScopeToggle(scope)}
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-900">{details.label}</span>
                              <ScopeBadge scope={scope} />
                            </div>
                            <p className="text-sm text-slate-600 mt-1">{details.description}</p>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {details.examples.map((example) => (
                                <span
                                  key={example}
                                  className="text-xs px-2 py-0.5 bg-white border border-slate-200 rounded"
                                >
                                  {example}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </FormGroup>
              </div>

              {/* Duration Info */}
              <div className="mb-6 p-4 bg-amber-50 rounded-lg border border-amber-100">
                <div className="flex items-start gap-3">
                  <WarningIcon />
                  <div>
                    <p className="text-sm font-medium text-amber-800">
                      This access will be valid for {expiryDays} days
                    </p>
                    <p className="text-xs text-amber-700 mt-1">
                      You can revoke access at any time from your Monitrax settings.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {step === 'confirm' && (
            <>
              <div className="mb-6 text-center">
                <div className="w-16 h-16 bg-emerald-100 rounded-full mx-auto flex items-center justify-center mb-4">
                  <CheckIcon />
                </div>
                <h2 className="text-lg font-semibold text-slate-900 mb-2">
                  Confirm Your Approval
                </h2>
                <p className="text-slate-600">
                  You're about to grant {organizationName} access to:
                </p>
                <div className="flex flex-wrap justify-center gap-2 mt-4">
                  {approvedScopes.map((scope) => (
                    <ScopeBadge key={scope} scope={scope} />
                  ))}
                </div>
              </div>

              <div className="mb-6 p-4 bg-slate-100 rounded-lg text-center">
                <p className="text-sm text-slate-600">
                  By approving, you agree to share the selected financial data with{' '}
                  <strong>{organizationName}</strong> for {expiryDays} days.
                </p>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex justify-between gap-3 pt-4 border-t border-slate-200">
            {step === 'confirm' && (
              <PortalButton
                variant="ghost"
                onClick={() => setStep('review')}
                disabled={submitting}
              >
                Back
              </PortalButton>
            )}
            <ButtonGroup className={step === 'review' ? 'w-full' : 'ml-auto'}>
              <PortalButton
                variant="outline"
                onClick={handleDeny}
                loading={submitting}
                disabled={submitting}
              >
                Deny Access
              </PortalButton>
              <PortalButton
                onClick={handleApprove}
                loading={submitting}
                disabled={submitting || approvedScopes.length === 0}
              >
                {step === 'review' ? 'Continue' : 'Approve Access'}
              </PortalButton>
            </ButtonGroup>
          </div>
        </PortalCard>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 mt-4">
          Powered by Monitrax • Your data stays secure
        </p>
      </div>
    </div>
  );
}

// Icons
function WarningIcon() {
  return (
    <svg className="w-5 h-5 text-amber-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
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

export default ConsentRequest;
