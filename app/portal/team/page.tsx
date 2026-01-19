/**
 * Phase 32: Portal Team Page
 *
 * Displays team members for the current organization.
 * Uses modular TeamList and InviteModal components.
 */

'use client';

import { useState, useEffect } from 'react';
import { TeamList } from '@/components/portal/team';
import { InviteModal, type InviteData } from '@/components/portal/team';
import { createTeamService, type TeamMember } from '@/lib/portal/services/team';

// TODO: Get from auth context
const MOCK_ORG_ID = 'demo-org-id';
const MOCK_USER_ID = 'demo-user-id';

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    pending: 0,
  });

  const teamApi = createTeamService(MOCK_ORG_ID);

  useEffect(() => {
    // In production, this would call the API
    // For now, set demo data showing current user as owner
    setMembers([
      {
        id: 'member-1',
        userId: MOCK_USER_ID,
        role: 'PORTAL_OWNER',
        invitedBy: null,
        invitedAt: new Date().toISOString(),
        joinedAt: new Date().toISOString(),
        isActive: true,
        user: {
          id: MOCK_USER_ID,
          email: 'owner@example.com',
          name: 'Organization Owner',
        },
        stats: {
          assignedClients: 0,
          pendingTasks: 0,
          notesCreated: 0,
        },
      },
    ]);
    setLoading(false);
    setStats({
      total: 1,
      active: 1,
      pending: 0,
    });
  }, []);

  const handleInvite = async (data: InviteData) => {
    const response = await teamApi.invite({
      email: data.email,
      role: data.role || 'PORTAL_ADVISOR',
      personalMessage: data.personalMessage,
    });

    if (response.error) {
      throw new Error(response.error.message);
    }

    // Refresh team list
    // loadTeam();
  };

  const handleEditRole = (member: TeamMember) => {
    // TODO: Show role edit modal
    console.log('Edit role:', member);
  };

  const handleRemove = (member: TeamMember) => {
    // TODO: Show confirmation dialog
    console.log('Remove member:', member);
  };

  const handleViewMember = (member: TeamMember) => {
    // TODO: Navigate to member detail or show modal
    console.log('View member:', member);
  };

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
        currentUserId={MOCK_USER_ID}
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
