/**
 * Phase 32: Client List Component
 *
 * MODULAR: Displays a list of clients with filtering and actions.
 * Can be used standalone or composed with other components.
 *
 * Phase 32B PR3 polish item ③ (2026-05-18) — optional `aggregateMap`
 * prop adds 3 columns when supplied: TRAIL stage, Health (score +
 * delta), Active alerts. Sourced from
 * `GET /api/portal/clients?organizationId=…` (the same aggregate
 * the dashboard hero strip reads). When the map is absent or has no
 * entry for a client, those columns render `—` gracefully.
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import { PortalCard, EmptyState, StatsCard } from '../ui/PortalCard';
import { PortalTable, Pagination, type TableColumn } from '../ui/PortalTable';
import { PortalButton, ButtonGroup } from '../ui/PortalButton';
import { SearchInput, Select } from '../ui/PortalForm';
import { ClientStatusBadge, ConsentBadge } from './ClientBadges';
import type { PortalClient } from '@/lib/portal/types';
import type { ClientStatus, ConsentStatus } from '@prisma/client';

/**
 * Per-client aggregate data from `GET /api/portal/clients?organizationId=…`.
 * Map keyed by `PortalClient.id` (== organizationClientId).
 */
export interface ClientAggregateRow {
  trailStage: 'TRACK' | 'REDUCE' | 'ANCHOR' | 'INVEST' | 'LIVE' | null;
  healthScore: number | null;
  healthDelta: number | null; // last - previous; null when no prior sweep
  activeAlertCount: number;
}

interface ClientListProps {
  clients: PortalClient[];
  loading?: boolean;
  pagination?: {
    page: number;
    totalPages: number;
    total: number;
  };
  onPageChange?: (page: number) => void;
  onClientClick?: (client: PortalClient) => void;
  onInviteClick?: () => void;
  onFilterChange?: (filters: ClientFilters) => void;
  stats?: {
    total: number;
    active: number;
    pending: number;
    invited: number;
  };
  /**
   * Phase 32B PR3 polish ③ — when supplied, the table renders 3
   * extra columns (TRAIL / Health / Alerts) using this aggregate
   * data. When undefined OR no entry for a given client, those
   * columns render `—`. Aggregate-only privacy posture (CLAUDE.md
   * §13.3) — no balances / no CDR data passes through this map.
   */
  aggregateMap?: Map<string, ClientAggregateRow>;
}

export interface ClientFilters {
  search: string;
  status: ClientStatus | '';
  consentStatus: ConsentStatus | '';
  assignedTo: string;
}

export function ClientList({
  clients,
  loading = false,
  pagination,
  onPageChange,
  onClientClick,
  onInviteClick,
  onFilterChange,
  stats,
  aggregateMap,
}: ClientListProps) {
  const [filters, setFilters] = useState<ClientFilters>({
    search: '',
    status: '',
    consentStatus: '',
    assignedTo: '',
  });

  const handleFilterChange = useCallback(
    (key: keyof ClientFilters, value: string) => {
      const newFilters = { ...filters, [key]: value };
      setFilters(newFilters);
      onFilterChange?.(newFilters);
    },
    [filters, onFilterChange]
  );

  const columns: TableColumn<PortalClient>[] = useMemo(() => {
    const cols: TableColumn<PortalClient>[] = [
      {
        key: 'user',
        header: 'Client',
        sortable: true,
        render: (client) => (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-sm font-medium text-slate-600">
              {client.user?.name?.charAt(0) || client.user?.email?.charAt(0) || '?'}
            </div>
            <div>
              <p className="font-medium text-slate-900">{client.user?.name || 'Unknown'}</p>
              <p className="text-xs text-slate-500">{client.user?.email}</p>
            </div>
          </div>
        ),
      },
      {
        key: 'clientReference',
        header: 'Reference',
        render: (client) => (
          <span className="text-sm text-slate-600">
            {client.clientReference || '-'}
          </span>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (client) => <ClientStatusBadge status={client.status} />,
      },
      {
        key: 'consentStatus',
        header: 'Consent',
        render: (client) => <ConsentBadge status={client.consentStatus} />,
      },
    ];

    // Phase 32B PR3 polish ③ — aggregate columns. Inserted between
    // Consent and Assigned To so the "human dimension" (TRAIL stage,
    // health, alerts) reads alongside the system fields (status/consent).
    if (aggregateMap) {
      cols.push({
        key: 'trailStage',
        header: 'TRAIL',
        render: (client) => <TrailStagePill stage={aggregateMap.get(client.id)?.trailStage ?? null} />,
      });
      cols.push({
        key: 'healthScore',
        header: 'Health',
        align: 'center',
        render: (client) => {
          const agg = aggregateMap.get(client.id);
          return <HealthCell score={agg?.healthScore ?? null} delta={agg?.healthDelta ?? null} />;
        },
      });
      cols.push({
        key: 'activeAlerts',
        header: 'Alerts',
        align: 'center',
        render: (client) => {
          const count = aggregateMap.get(client.id)?.activeAlertCount ?? 0;
          return (
            <span
              className={`inline-flex items-center justify-center w-6 h-6 text-xs font-medium rounded-full ${
                count > 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {count}
            </span>
          );
        },
      });
    }

    cols.push(
      {
        key: 'assignedTo',
        header: 'Assigned To',
        render: (client) => (
          <span className="text-sm text-slate-600">
            {client.assignedTo?.user?.name || 'Unassigned'}
          </span>
        ),
      },
      {
        key: 'pendingTasks',
        header: 'Tasks',
        align: 'center',
        render: (client) => (
          <span className={`inline-flex items-center justify-center w-6 h-6 text-xs font-medium rounded-full ${
            (client.pendingTasksCount || 0) > 0
              ? 'bg-amber-100 text-amber-700'
              : 'bg-slate-100 text-slate-500'
          }`}>
            {client.pendingTasksCount || 0}
          </span>
        ),
      },
      {
        key: 'actions',
        header: '',
        width: '80px',
        align: 'right',
        render: (client) => (
          <PortalButton
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onClientClick?.(client);
            }}
          >
            View
          </PortalButton>
        ),
      },
    );

    return cols;
  }, [aggregateMap, onClientClick]);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Total Clients"
            value={stats.total}
            loading={loading}
          />
          <StatsCard
            title="Active"
            value={stats.active}
            subtitle="Consent granted"
            loading={loading}
          />
          <StatsCard
            title="Pending Consent"
            value={stats.pending}
            loading={loading}
          />
          <StatsCard
            title="Invited"
            value={stats.invited}
            subtitle="Awaiting response"
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
                placeholder="Search clients..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                onClear={() => handleFilterChange('search', '')}
              />
            </div>
            <div className="flex gap-2">
              <Select
                options={[
                  { value: '', label: 'All Statuses' },
                  { value: 'INVITED', label: 'Invited' },
                  { value: 'PENDING', label: 'Pending' },
                  { value: 'ACTIVE', label: 'Active' },
                  { value: 'SUSPENDED', label: 'Suspended' },
                  { value: 'ARCHIVED', label: 'Archived' },
                ]}
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
              />
              <Select
                options={[
                  { value: '', label: 'All Consent' },
                  { value: 'PENDING', label: 'Pending' },
                  { value: 'GRANTED', label: 'Granted' },
                  { value: 'REVOKED', label: 'Revoked' },
                  { value: 'EXPIRED', label: 'Expired' },
                ]}
                value={filters.consentStatus}
                onChange={(e) => handleFilterChange('consentStatus', e.target.value)}
              />
            </div>
          </div>
          <ButtonGroup>
            {onInviteClick && (
              <PortalButton onClick={onInviteClick}>
                <PlusIcon />
                <span className="ml-2">Invite Client</span>
              </PortalButton>
            )}
          </ButtonGroup>
        </div>

        {/* Table */}
        {clients.length === 0 && !loading ? (
          <EmptyState
            icon={<ClientsIcon />}
            title="No clients yet"
            description="Invite your first client to start managing their financial data."
            action={
              onInviteClick && (
                <PortalButton onClick={onInviteClick}>
                  Invite Your First Client
                </PortalButton>
              )
            }
          />
        ) : (
          <PortalTable
            columns={columns}
            data={clients}
            keyExtractor={(client) => client.id}
            loading={loading}
            onRowClick={onClientClick}
            sortable
            defaultSortKey="user"
          />
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={pagination.total}
            onPageChange={onPageChange || (() => {})}
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

function ClientsIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

// Phase 32B PR3 polish ③ — small render helpers for the aggregate cols.

const TRAIL_STAGE_TONE: Record<NonNullable<ClientAggregateRow['trailStage']>, { label: string; className: string }> = {
  TRACK: { label: 'Track', className: 'bg-sky-100 text-sky-700' },
  REDUCE: { label: 'Reduce', className: 'bg-amber-100 text-amber-700' },
  ANCHOR: { label: 'Anchor', className: 'bg-emerald-100 text-emerald-700' },
  INVEST: { label: 'Invest', className: 'bg-indigo-100 text-indigo-700' },
  LIVE: { label: 'Live', className: 'bg-fuchsia-100 text-fuchsia-700' },
};

function TrailStagePill({ stage }: { stage: ClientAggregateRow['trailStage'] }) {
  if (!stage) {
    return <span className="text-xs text-slate-400">—</span>;
  }
  const tone = TRAIL_STAGE_TONE[stage];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${tone.className}`}>
      {tone.label}
    </span>
  );
}

function HealthCell({ score, delta }: { score: number | null; delta: number | null }) {
  if (score == null) {
    return <span className="text-xs text-slate-400">—</span>;
  }
  // Score tone: emerald ≥ 70, amber 40–69, rose < 40.
  const scoreTone =
    score >= 70 ? 'text-emerald-700' : score >= 40 ? 'text-amber-700' : 'text-rose-700';
  const deltaLabel =
    delta == null
      ? null
      : delta === 0
        ? 'stable'
        : `${delta > 0 ? '↑' : '↓'} ${Math.abs(delta)}`;
  const deltaTone =
    delta == null
      ? 'text-slate-400'
      : delta === 0
        ? 'text-slate-500'
        : delta > 0
          ? 'text-emerald-600'
          : 'text-rose-600';
  return (
    <div className="flex items-center justify-center gap-1 tabular-nums">
      <span className={`text-sm font-semibold ${scoreTone}`}>{score}</span>
      {deltaLabel && <span className={`text-[11px] ${deltaTone}`}>{deltaLabel}</span>}
    </div>
  );
}

export default ClientList;
