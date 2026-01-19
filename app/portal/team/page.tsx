/**
 * Phase 32: Portal Team Page
 *
 * Displays team members for the current organization.
 * Uses modular TeamList and InviteModal components.
 */

'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { TeamList } from '@/components/portal/team';
import { InviteModal, type InviteData } from '@/components/portal/team';
import { createTeamService, type TeamMember } from '@/lib/portal/services/team';
import { useOrganization } from '@/lib/portal';
import { useAuth } from '@/lib/context/AuthContext';

export default function TeamPage() {
  const { currentOrg, isLoading: orgLoading } = useOrganization();
  const { user } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    pending: 0,
  });

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
    // TODO: Show role edit modal
    console.log('Edit role:', member);
  };

  const handleRemove = async (member: TeamMember) => {
    if (!teamApi) return;

    // TODO: Show confirmation dialog
    const confirmed = window.confirm(`Are you sure you want to remove ${member.user?.name || member.user?.email}?`);
    if (!confirmed) return;

    const response = await teamApi.remove(member.id);
    if (response.error) {
      console.error('Failed to remove member:', response.error);
      return;
    }

    // Refresh team list
    loadTeam();
  };

  const handleViewMember = (member: TeamMember) => {
    // TODO: Navigate to member detail or show modal
    console.log('View member:', member);
  };

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
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Team</h1>
        <p className="text-slate-500 mt-1">
          Manage your team members and their access to client data
        </p>
      </div>

      <TeamList
        members={members}
        currentUserId={user?.id || ''}
        loading={loading}
        stats={stats}
        onInvite={() => setShowInviteModal(true)}
        onEditRole={handleEditRole}
        onRemove={handleRemove}
        onViewMember={handleViewMember}
      />

      {showInviteModal && (
        <InviteModal
          type="staff"
          onSubmit={handleInvite}
          onClose={() => setShowInviteModal(false)}
        />
      )}
    </div>
  );
}
