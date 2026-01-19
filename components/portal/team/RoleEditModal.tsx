/**
 * Phase 32: Role Edit Modal
 *
 * Modal for editing a team member's role with permission preview.
 */

'use client';

import { useState } from 'react';
import { PortalButton } from '../ui/PortalButton';
import type { TeamMember } from '@/lib/portal/services/team';
import type { PortalUserRole } from '@prisma/client';

interface RoleEditModalProps {
  member: TeamMember;
  currentUserRole: PortalUserRole;
  onSave: (memberId: string, newRole: PortalUserRole) => Promise<void>;
  onClose: () => void;
}

// Role configuration with descriptions
const ROLES: {
  value: PortalUserRole;
  label: string;
  description: string;
  permissions: string[];
  color: string;
}[] = [
  {
    value: 'PORTAL_ADMIN',
    label: 'Admin',
    description: 'Full access to organization settings and team management',
    permissions: [
      'Manage organization settings and branding',
      'Invite and remove team members',
      'Manage all clients and their data',
      'Create and manage integrations',
      'View audit logs',
    ],
    color: 'border-blue-500 bg-blue-50',
  },
  {
    value: 'PORTAL_ADVISOR',
    label: 'Advisor',
    description: 'Can manage assigned clients and create notes/tasks',
    permissions: [
      'View assigned clients only',
      'Access client financial data (with consent)',
      'Create and manage notes',
      'Create and complete tasks',
      'View team member list',
    ],
    color: 'border-green-500 bg-green-50',
  },
  {
    value: 'PORTAL_VIEWER',
    label: 'Viewer',
    description: 'Read-only access to organization data',
    permissions: [
      'View client list (read-only)',
      'View client data (with consent)',
      'View notes (read-only)',
      'View tasks (read-only)',
      'View team member list',
    ],
    color: 'border-slate-500 bg-slate-50',
  },
];

// Role hierarchy - higher number = more permissions
const ROLE_LEVELS: Record<PortalUserRole, number> = {
  PORTAL_OWNER: 4,
  PORTAL_ADMIN: 3,
  PORTAL_ADVISOR: 2,
  PORTAL_VIEWER: 1,
};

export function RoleEditModal({
  member,
  currentUserRole,
  onSave,
  onClose,
}: RoleEditModalProps) {
  const [selectedRole, setSelectedRole] = useState<PortalUserRole>(member.role);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter available roles based on current user's role
  // Users can only assign roles below their own level
  const availableRoles = ROLES.filter(
    (role) => ROLE_LEVELS[role.value] < ROLE_LEVELS[currentUserRole]
  );

  const handleSave = async () => {
    if (selectedRole === member.role) {
      onClose();
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await onSave(member.id, selectedRole);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setIsLoading(false);
    }
  };

  const isRoleChange = selectedRole !== member.role;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">
            Edit Role
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Change the role for {member.user.name || member.user.email}
          </p>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto max-h-[60vh]">
          {/* Member Info */}
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg mb-4">
            <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center text-sm font-medium text-slate-600">
              {member.user.name?.charAt(0) || member.user.email?.charAt(0) || '?'}
            </div>
            <div>
              <p className="font-medium text-slate-900">{member.user.name || 'Unknown'}</p>
              <p className="text-sm text-slate-500">{member.user.email}</p>
            </div>
          </div>

          {/* Role Selection */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700">
              Select Role
            </label>

            {availableRoles.length === 0 ? (
              <p className="text-sm text-amber-600 p-3 bg-amber-50 rounded-lg">
                You don&apos;t have permission to change this member&apos;s role.
              </p>
            ) : (
              <div className="space-y-2">
                {availableRoles.map((role) => (
                  <label
                    key={role.value}
                    className={`block p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      selectedRole === role.value
                        ? role.color
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="role"
                        value={role.value}
                        checked={selectedRole === role.value}
                        onChange={() => setSelectedRole(role.value)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">{role.label}</p>
                        <p className="text-sm text-slate-500 mt-0.5">
                          {role.description}
                        </p>
                        <ul className="mt-2 space-y-1">
                          {role.permissions.map((permission, idx) => (
                            <li
                              key={idx}
                              className="text-xs text-slate-600 flex items-center gap-2"
                            >
                              <CheckIcon className="w-3 h-3 text-green-500 flex-shrink-0" />
                              {permission}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Role Change Warning */}
          {isRoleChange && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-700">
                <strong>Note:</strong> Changing the role will immediately update the
                member&apos;s access permissions.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <PortalButton
            variant="secondary"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </PortalButton>
          <PortalButton
            onClick={handleSave}
            disabled={isLoading || !isRoleChange || availableRoles.length === 0}
            loading={isLoading}
          >
            {isLoading ? 'Saving...' : 'Save Changes'}
          </PortalButton>
        </div>
      </div>
    </div>
  );
}

// Icons
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

export default RoleEditModal;
