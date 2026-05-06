/**
 * Phase 32: Portal Team Page
 *
 * Displays team members for the current organization.
 * Includes role management and invitation functionality.
 */

'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { TeamList, InviteModal, RoleEditModal } from '@/components/portal/team';
import { PortalPageHero } from '@/components/shell';
import type { InviteData } from '@/components/portal/team';
import { createTeamService, type TeamMember } from '@/lib/portal/services/team';
import { useOrganization } from '@/lib/portal';
import { useAuth } from '@/lib/context/AuthContext';
import type { PortalUserRole } from '@prisma/client';

// Map organization role to portal role
function mapToPortalRole(role: string): PortalUserRole {
  const roleMap: Record<string, PortalUserRole> = {
    OWNER: 'PORTAL_OWNER',
    ADMIN: 'PORTAL_ADMIN',
    CONTRIBUTOR: 'PORTAL_ADVISOR',
    VIEWER: 'PORTAL_VIEWER',
    PORTAL_OWNER: 'PORTAL_OWNER',
    PORTAL_ADMIN: 'PORTAL_ADMIN',
    PORTAL_ADVISOR: 'PORTAL_ADVISOR',
    PORTAL_VIEWER: 'PORTAL_VIEWER',
  };
  return roleMap[role] || 'PORTAL_VIEWER';
}

export default function TeamPage() {
  const { currentOrg, isLoading: orgLoading } = useOrganization();
  const { user } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    pending: 0,
  });

  // Get current user's role in the organization
  const currentUserRole = useMemo<PortalUserRole>(() => {
    if (!currentOrg?.role) return 'PORTAL_VIEWER';
    return mapToPortalRole(currentOrg.role);
  }, [currentOrg]);

  // Create team service with current organization ID
  const teamApi = useMemo(
    () => (currentOrg ? createTeamService(currentOrg.id) : null),
    [currentOrg]
  );

  const loadTeam = useCallback(async () => {
    if (!teamApi) return;

    setLoading(true);
    try {
      const response = await teamApi.list();

      if (response.data) {
        setMembers(response.data.items);
        // Calculate stats from the response
        const activeCount = response.data.items.filter((m) => m.isActive && m.joinedAt).length;
        const pendingCount = response.data.items.filter((m) => !m.joinedAt).length;
        setStats({
          total: response.data.items.length,
          active: activeCount,
          pending: pendingCount,
        });
      }
    } catch (error) {
      console.error('Failed to load team:', error);
    } finally {
      setLoading(false);
    }
  }, [teamApi]);

  useEffect(() => {
    if (!orgLoading && currentOrg && teamApi) {
      loadTeam();
    } else if (!orgLoading && !currentOrg) {
      // No organization selected
      setMembers([]);
      setLoading(false);
    }
  }, [orgLoading, currentOrg, teamApi, loadTeam]);

  const handleInvite = async (data: InviteData) => {
    if (!teamApi) {
      throw new Error('No organization selected');
    }

    const response = await teamApi.invite({
      email: data.email,
      role: data.role || 'PORTAL_ADVISOR',
      personalMessage: data.personalMessage,
    });

    if (response.error) {
      throw new Error(response.error.message);
    }

    // Refresh team list
    loadTeam();
  };

  const handleEditRole = (member: TeamMember) => {
    setEditingMember(member);
  };

  const handleSaveRole = async (memberId: string, newRole: PortalUserRole) => {
    if (!teamApi) {
      throw new Error('No organization selected');
    }

    const response = await teamApi.updateRole(memberId, newRole);

    if (response.error) {
      throw new Error(response.error.message);
    }

    // Refresh team list
    loadTeam();
  };

  const handleRemove = async (member: TeamMember) => {
    if (!teamApi) return;

    const confirmed = window.confirm(
      `Are you sure you want to remove ${member.user?.name || member.user?.email} from the team?\n\nThis will revoke their access to the organization.`
    );
    if (!confirmed) return;

    const response = await teamApi.remove(member.id);
    if (response.error) {
      console.error('Failed to remove member:', response.error);
      alert('Failed to remove member: ' + response.error.message);
      return;
    }

    // Refresh team list
    loadTeam();
  };

  const handleViewMember = (member: TeamMember) => {
    // For now, just open the edit modal to view details
    setEditingMember(member);
  };

  // Check if current user can manage team
  const canManageTeam = ['PORTAL_OWNER', 'PORTAL_ADMIN'].includes(currentUserRole);

  // Show loading while organization is loading
  if (orgLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-slate-500 mt-4">Loading organization...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show message if no organization is selected
  if (!currentOrg) {
    return (
      <div className="p-6">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
          <p className="text-amber-800 font-medium">No Organization Selected</p>
          <p className="text-amber-600 text-sm mt-1">
            Please select or create an organization to manage team members.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
      <PortalPageHero
        atmosphere="emerald"
        title="Team management"
        subtitle="Manage your team members and their access permissions."
        actions={
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600">Your role</span>
            <RoleBadge role={currentUserRole} />
          </div>
        }
      />

      <TeamList
        members={members}
        currentUserId={user?.id || ''}
        loading={loading}
        stats={stats}
        onInvite={canManageTeam ? () => setShowInviteModal(true) : undefined}
        onEditRole={canManageTeam ? handleEditRole : undefined}
        onRemove={canManageTeam ? handleRemove : undefined}
        onViewMember={handleViewMember}
      />

      {/* Invite Modal */}
      {showInviteModal && (
        <InviteModal
          type="staff"
          onSubmit={handleInvite}
          onClose={() => setShowInviteModal(false)}
        />
      )}

      {/* Role Edit Modal */}
      {editingMember && (
        <RoleEditModal
          member={editingMember}
          currentUserRole={currentUserRole}
          onSave={handleSaveRole}
          onClose={() => setEditingMember(null)}
        />
      )}
    </div>
  );
}

// Role Badge Component
function RoleBadge({ role }: { role: PortalUserRole }) {
  const config: Record<PortalUserRole, { label: string; className: string }> = {
    PORTAL_OWNER: { label: 'Owner', className: 'bg-purple-100 text-purple-700' },
    PORTAL_ADMIN: { label: 'Admin', className: 'bg-blue-100 text-blue-700' },
    PORTAL_ADVISOR: { label: 'Advisor', className: 'bg-green-100 text-green-700' },
    PORTAL_VIEWER: { label: 'Viewer', className: 'bg-slate-100 text-slate-600' },
  };

  const { label, className } = config[role] || { label: 'Unknown', className: 'bg-slate-100 text-slate-600' };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${className}`}>
      {label}
    </span>
  );
}
