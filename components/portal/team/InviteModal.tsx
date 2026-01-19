/**
 * Phase 32: Invite Modal Component
 *
 * MODULAR: Modal for inviting team members or clients.
 * Can be used for both staff and client invitations.
 */

'use client';

import { useState } from 'react';
import { PortalButton, ButtonGroup } from '../ui/PortalButton';
import { Input, Textarea, Select, FormGroup, Checkbox } from '../ui/PortalForm';
import type { PortalUserRole, DataAccessScope } from '@prisma/client';

interface InviteModalProps {
  type: 'staff' | 'client';
  onSubmit: (data: InviteData) => Promise<void>;
  onClose: () => void;
  loading?: boolean;
}

export interface InviteData {
  email: string;
  role?: PortalUserRole;
  requestedScopes?: DataAccessScope[];
  personalMessage?: string;
}

const scopeOptions: { value: DataAccessScope; label: string; description: string }[] = [
  { value: 'FULL', label: 'Full Access', description: 'Access to all client data' },
  { value: 'FINANCIAL', label: 'Financial Data', description: 'Accounts and balances' },
  { value: 'TRANSACTIONS', label: 'Transactions', description: 'Transaction history' },
  { value: 'INVESTMENTS', label: 'Investments', description: 'Investment accounts and holdings' },
  { value: 'TAX', label: 'Tax Information', description: 'Tax-related data' },
  { value: 'PROPERTIES', label: 'Properties', description: 'Property details' },
  { value: 'LOANS', label: 'Loans', description: 'Loan information' },
  { value: 'DOCUMENTS', label: 'Documents', description: 'Uploaded files' },
];

export function InviteModal({ type, onSubmit, onClose, loading = false }: InviteModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<PortalUserRole>('PORTAL_ADVISOR');
  const [selectedScopes, setSelectedScopes] = useState<DataAccessScope[]>(['FINANCIAL', 'TRANSACTIONS']);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleScopeToggle = (scope: DataAccessScope) => {
    setSelectedScopes((prev) => {
      if (prev.includes(scope)) {
        return prev.filter((s) => s !== scope);
      }
      // If selecting FULL, clear others
      if (scope === 'FULL') {
        return ['FULL'];
      }
      // If selecting other while FULL is selected, remove FULL
      return [...prev.filter((s) => s !== 'FULL'), scope];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    if (!email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    if (type === 'client' && selectedScopes.length === 0) {
      setError('Please select at least one access scope');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await onSubmit({
        email: email.trim().toLowerCase(),
        role: type === 'staff' ? role : undefined,
        requestedScopes: type === 'client' ? selectedScopes : undefined,
        personalMessage: message.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">
            {type === 'staff' ? 'Invite Team Member' : 'Invite Client'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4">
          <FormGroup>
            <Input
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={type === 'staff' ? 'colleague@example.com' : 'client@example.com'}
              required
            />

            {type === 'staff' && (
              <Select
                label="Role"
                value={role}
                onChange={(e) => setRole(e.target.value as PortalUserRole)}
                options={[
                  { value: 'PORTAL_ADMIN', label: 'Admin - Can manage team and clients' },
                  { value: 'PORTAL_ADVISOR', label: 'Advisor - Can view assigned clients' },
                  { value: 'PORTAL_VIEWER', label: 'Viewer - Read-only access' },
                ]}
                hint="Choose the level of access for this team member"
              />
            )}

            {type === 'client' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Requested Access Scopes
                </label>
                <p className="text-xs text-slate-500 mb-3">
                  Select the data you'd like access to. The client will need to approve these.
                </p>
                <div className="space-y-2 max-h-48 overflow-y-auto p-2 border border-slate-200 rounded-lg">
                  {scopeOptions.map((option) => (
                    <Checkbox
                      key={option.value}
                      label={option.label}
                      description={option.description}
                      checked={selectedScopes.includes(option.value)}
                      onChange={() => handleScopeToggle(option.value)}
                    />
                  ))}
                </div>
              </div>
            )}

            <Textarea
              label="Personal Message (Optional)"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a personal note to include in the invitation email..."
              rows={3}
            />

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
          </FormGroup>

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
            <ButtonGroup>
              <PortalButton type="button" variant="outline" onClick={onClose}>
                Cancel
              </PortalButton>
              <PortalButton type="submit" loading={submitting || loading}>
                Send Invitation
              </PortalButton>
            </ButtonGroup>
          </div>
        </form>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

export default InviteModal;
