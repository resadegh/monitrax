/**
 * Phase 32: Team List Component
 *
 * MODULAR: Displays team members with role management.
 * Can be used standalone or composed with other components.
 */

'use client';

import { useState } from 'react';
import { PortalCard, CardHeader, StatsCard, EmptyState } from '../ui/PortalCard';
import { PortalTable, type TableColumn } from '../ui/PortalTable';
import { PortalButton, ButtonGroup } from '../ui/PortalButton';
import { SearchInput, Select } from '../ui/PortalForm';
import type { TeamMember } from '@/lib/portal/services/team';
import type { PortalUserRole } from '@prisma/client';

interface TeamListProps {
  members: TeamMember[];
  currentUserId: string;
  loading?: boolean;
  onInvite?: () => void;
  onEditRole?: (member: TeamMember) => void;
  onRemove?: (member: TeamMember) => void;
  onViewMember?: (member: TeamMember) => void;
  stats?: {
    total: number;
    active: number;
    pending: number;
  };
}

const roleConfig: Record<PortalUserRole, { label: string; className: string }> = {
  PORTAL_OWNER: {
    label: 'Owner',
    className: 'bg-purple-100 text-purple-700',
  },
  PORTAL_ADMIN: {
    label: 'Admin',
    className: 'bg-blue-100 text-blue-700',
  },
  PORTAL_ADVISOR: {
    label: 'Advisor',
    className: 'bg-emerald-100 text-emerald-700',
  },
  PORTAL_VIEWER: {
    label: 'Viewer',
    className: 'bg-slate-100 text-slate-600',
  },
};

export function TeamList({
  members,
  currentUserId,
  loading = false,
  onInvite,
  onEditRole,
  onRemove,
  onViewMember,
  stats,
}: TeamListProps) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');

  // Filter members
  const filteredMembers = members.filter((member) => {
    const matchesSearch = !search ||
      member.user.name.toLowerCase().includes(search.toLowerCase()) ||
      member.user.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = !roleFilter || member.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const columns: TableColumn<TeamMember>[] = [
    {
      key: 'user',
      header: 'Member',
      render: (member) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-sm font-medium text-slate-600">
            {member.user.name?.charAt(0) || member.user.email?.charAt(0) || '?'}
          </div>
          <div>
            <p className="font-medium text-slate-900">
              {member.user.name || 'Unknown'}
              {member.userId === currentUserId && (
                <span className="ml-2 text-xs text-slate-400">(You)</span>
              )}
            </p>
            <p className="text-xs text-slate-500">{member.user.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (member) => {
        const config = roleConfig[member.role];
        return (
          <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${config.className}`}>
            {config.label}
          </span>
        );
      },
    },
    {
      key: 'clients',
      header: 'Clients',
      align: 'center',
      render: (member) => (
        <span className="text-sm text-slate-600">
          {member.stats?.assignedClients ?? 0}
        </span>
      ),
    },
    {
      key: 'tasks',
      header: 'Pending Tasks',
      align: 'center',
      render: (member) => (
        <span className={`inline-flex items-center justify-center w-6 h-6 text-xs font-medium rounded-full ${
          (member.stats?.pendingTasks || 0) > 0
            ? 'bg-amber-100 text-amber-700'
            : 'bg-slate-100 text-slate-500'
        }`}>
          {member.stats?.pendingTasks ?? 0}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (member) => (
        <span className={`inline-flex items-center gap-1.5 text-xs ${
          member.isActive ? 'text-emerald-600' : 'text-slate-400'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${
            member.isActive ? 'bg-emerald-500' : 'bg-slate-300'
          }`} />
          {member.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '120px',
      align: 'right',
      render: (member) => {
        const isCurrentUser = member.userId === currentUserId;
        const isOwner = member.role === 'PORTAL_OWNER';

        return (
          <div className="flex items-center gap-1 justify-end">
            {onViewMember && (
              <PortalButton
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewMember(member);
                }}
              >
                View
              </PortalButton>
            )}
            {onEditRole && !isOwner && !isCurrentUser && (
              <PortalButton
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditRole(member);
                }}
              >
                Edit
              </PortalButton>
            )}
            {onRemove && !isOwner && !isCurrentUser && (
              <PortalButton
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(member);
                }}
              >
                Remove
              </PortalButton>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <StatsCard
            title="Total Members"
            value={stats.total}
            loading={loading}
          />
          <StatsCard
            title="Active"
            value={stats.active}
            loading={loading}
          />
          <StatsCard
            title="Pending Invites"
            value={stats.pending}
            loading={loading}
          />
        </div>
      )}

      {/* Filters and Actions */}
      <PortalCard>
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-4">
          <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full sm:w-auto">
            <div className="w-full sm:w-64">
              <SearchInput
                placeholder="Search members..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClear={() => setSearch('')}
              />
            </div>
            <Select
              options={[
                { value: '', label: 'All Roles' },
                { value: 'PORTAL_OWNER', label: 'Owner' },
                { value: 'PORTAL_ADMIN', label: 'Admin' },
                { value: 'PORTAL_ADVISOR', label: 'Advisor' },
                { value: 'PORTAL_VIEWER', label: 'Viewer' },
              ]}
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            />
          </div>
          <ButtonGroup>
            {onInvite && (
              <PortalButton onClick={onInvite}>
                <PlusIcon />
                <span className="ml-2">Invite Member</span>
              </PortalButton>
            )}
          </ButtonGroup>
        </div>

        {/* Table */}
        {filteredMembers.length === 0 && !loading ? (
          <EmptyState
            icon={<TeamIcon />}
            title="No team members"
            description="Invite team members to help manage your clients."
            action={
              onInvite && (
                <PortalButton onClick={onInvite}>
                  Invite Your First Member
                </PortalButton>
              )
            }
          />
        ) : (
          <PortalTable
            columns={columns}
            data={filteredMembers}
            keyExtractor={(member) => member.id}
            loading={loading}
            onRowClick={onViewMember}
          />
        )}
      </PortalCard>
    </div>
  );
}

// Icons
function PlusIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function TeamIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

export default TeamList;
