/**
 * Phase 32: Client Detail Component
 *
 * MODULAR: Displays detailed client information with tabs.
 * Can be used as a page or within a modal/drawer.
 */

'use client';

import { useState, ReactNode } from 'react';
import { PortalCard, CardHeader, StatsCard, EmptyState } from '../ui/PortalCard';
import { PortalButton, ButtonGroup } from '../ui/PortalButton';
import { ClientStatusBadge, ConsentBadge, ScopeList } from './ClientBadges';
import type { PortalClient, ClientNote, ClientTask } from '@/lib/portal/types';

type TabId = 'overview' | 'financial' | 'notes' | 'tasks' | 'activity';

interface ClientDetailProps {
  client: PortalClient;
  notes?: ClientNote[];
  tasks?: ClientTask[];
  onBack?: () => void;
  onEdit?: () => void;
  onArchive?: () => void;
  onRequestConsent?: () => void;
  onAddNote?: () => void;
  onAddTask?: () => void;
  loading?: boolean;
}

export function ClientDetail({
  client,
  notes = [],
  tasks = [],
  onBack,
  onEdit,
  onArchive,
  onRequestConsent,
  onAddNote,
  onAddTask,
  loading = false,
}: ClientDetailProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'financial', label: 'Financial Data' },
    { id: 'notes', label: 'Notes', count: notes.length },
    { id: 'tasks', label: 'Tasks', count: tasks.filter((t) => t.status !== 'COMPLETED').length },
    { id: 'activity', label: 'Activity' },
  ];

  const canAccessData = client.consentStatus === 'GRANTED' && client.status === 'ACTIVE';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <BackIcon />
            </button>
          )}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center text-xl font-semibold text-slate-600">
              {client.user?.name?.charAt(0) || '?'}
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                {client.user?.name || 'Unknown Client'}
              </h1>
              <p className="text-sm text-slate-500">{client.user?.email}</p>
              <div className="flex items-center gap-2 mt-1">
                <ClientStatusBadge status={client.status} />
                <ConsentBadge
                  status={client.consentStatus}
                  expiresAt={client.consentExpiresAt}
                />
              </div>
            </div>
          </div>
        </div>
        <ButtonGroup>
          {client.consentStatus !== 'GRANTED' && onRequestConsent && (
            <PortalButton variant="outline" onClick={onRequestConsent}>
              Request Consent
            </PortalButton>
          )}
          {onEdit && (
            <PortalButton variant="outline" onClick={onEdit}>
              Edit
            </PortalButton>
          )}
          {onArchive && client.status !== 'ARCHIVED' && (
            <PortalButton variant="ghost" onClick={onArchive}>
              Archive
            </PortalButton>
          )}
        </ButtonGroup>
      </div>

      {/* Client Info Card */}
      <PortalCard>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <InfoItem label="Reference" value={client.clientReference || '-'} />
          <InfoItem
            label="Assigned To"
            value={client.assignedTo?.user?.name || 'Unassigned'}
          />
          <InfoItem
            label="Onboarded"
            value={client.onboardedAt ? formatDate(client.onboardedAt) : 'Not yet'}
          />
          <InfoItem
            label="Last Accessed"
            value={client.lastAccessedAt ? formatDate(client.lastAccessedAt) : 'Never'}
          />
        </div>
        {client.accessScopes.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs font-medium text-slate-500 uppercase mb-2">
              Granted Access Scopes
            </p>
            <ScopeList scopes={client.accessScopes} maxVisible={8} />
          </div>
        )}
      </PortalCard>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-xs bg-slate-100 rounded-full">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab client={client} canAccessData={canAccessData} />
      )}
      {activeTab === 'financial' && (
        <FinancialTab client={client} canAccessData={canAccessData} />
      )}
      {activeTab === 'notes' && (
        <NotesTab notes={notes} onAddNote={onAddNote} />
      )}
      {activeTab === 'tasks' && (
        <TasksTab tasks={tasks} onAddTask={onAddTask} />
      )}
      {activeTab === 'activity' && (
        <ActivityTab clientId={client.id} />
      )}
    </div>
  );
}

// ============================================================================
// TAB COMPONENTS
// ============================================================================

function OverviewTab({
  client,
  canAccessData,
}: {
  client: PortalClient;
  canAccessData: boolean;
}) {
  if (!canAccessData) {
    return (
      <PortalCard>
        <EmptyState
          icon={<LockIcon />}
          title="Consent Required"
          description="This client has not granted consent to access their financial data. Send a consent request to view their information."
        />
      </PortalCard>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatsCard title="Net Worth" value="$--" subtitle="Consent required for data" />
      <StatsCard title="Monthly Income" value="$--" />
      <StatsCard title="Monthly Expenses" value="$--" />
      <StatsCard title="Cashflow" value="$--" />
    </div>
  );
}

function FinancialTab({
  client,
  canAccessData,
}: {
  client: PortalClient;
  canAccessData: boolean;
}) {
  if (!canAccessData) {
    return (
      <PortalCard>
        <EmptyState
          icon={<LockIcon />}
          title="Consent Required"
          description="Financial data access requires client consent."
        />
      </PortalCard>
    );
  }

  return (
    <div className="space-y-4">
      <PortalCard>
        <CardHeader title="Accounts" description="Client's bank accounts and balances" />
        <EmptyState
          title="Coming Soon"
          description="Financial data view will be available once the client integration is complete."
        />
      </PortalCard>
    </div>
  );
}

function NotesTab({
  notes,
  onAddNote,
}: {
  notes: ClientNote[];
  onAddNote?: () => void;
}) {
  return (
    <PortalCard>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-slate-900">Notes</h3>
        {onAddNote && (
          <PortalButton size="sm" onClick={onAddNote}>
            Add Note
          </PortalButton>
        )}
      </div>
      {notes.length === 0 ? (
        <EmptyState
          icon={<NoteIcon />}
          title="No notes yet"
          description="Add notes to keep track of important information about this client."
          action={onAddNote && <PortalButton onClick={onAddNote}>Add First Note</PortalButton>}
        />
      ) : (
        <div className="space-y-4">
          {notes.map((note) => (
            <div key={note.id} className="p-4 bg-slate-50 rounded-lg">
              {note.title && (
                <h4 className="font-medium text-slate-900 mb-1">{note.title}</h4>
              )}
              <p className="text-sm text-slate-600">{note.content}</p>
              <p className="text-xs text-slate-400 mt-2">
                {formatDate(note.createdAt)}
              </p>
            </div>
          ))}
        </div>
      )}
    </PortalCard>
  );
}

function TasksTab({
  tasks,
  onAddTask,
}: {
  tasks: ClientTask[];
  onAddTask?: () => void;
}) {
  const pendingTasks = tasks.filter((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED');
  const completedTasks = tasks.filter((t) => t.status === 'COMPLETED');

  return (
    <PortalCard>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-slate-900">Tasks</h3>
        {onAddTask && (
          <PortalButton size="sm" onClick={onAddTask}>
            Add Task
          </PortalButton>
        )}
      </div>
      {tasks.length === 0 ? (
        <EmptyState
          icon={<TaskIcon />}
          title="No tasks yet"
          description="Create tasks to track action items for this client."
          action={onAddTask && <PortalButton onClick={onAddTask}>Create First Task</PortalButton>}
        />
      ) : (
        <div className="space-y-4">
          {pendingTasks.map((task) => (
            <TaskItem key={task.id} task={task} />
          ))}
          {completedTasks.length > 0 && (
            <div className="pt-4 border-t border-slate-100">
              <p className="text-xs font-medium text-slate-400 uppercase mb-3">
                Completed ({completedTasks.length})
              </p>
              {completedTasks.slice(0, 3).map((task) => (
                <TaskItem key={task.id} task={task} />
              ))}
            </div>
          )}
        </div>
      )}
    </PortalCard>
  );
}

function TaskItem({ task }: { task: ClientTask }) {
  const isCompleted = task.status === 'COMPLETED';

  return (
    <div className={`p-3 bg-slate-50 rounded-lg ${isCompleted ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={isCompleted}
          readOnly
          className="mt-1 w-4 h-4 rounded border-slate-300"
        />
        <div className="flex-1">
          <p className={`text-sm font-medium ${isCompleted ? 'line-through text-slate-500' : 'text-slate-900'}`}>
            {task.title}
          </p>
          {task.dueDate && !isCompleted && (
            <p className="text-xs text-slate-500 mt-1">
              Due: {formatDate(task.dueDate)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ActivityTab({ clientId }: { clientId: string }) {
  return (
    <PortalCard>
      <CardHeader title="Activity Log" description="Recent access and changes" />
      <EmptyState
        title="Activity tracking"
        description="Activity log will show all access events for compliance purposes."
      />
    </PortalCard>
  );
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500 uppercase">{label}</p>
      <p className="text-sm text-slate-900 mt-1">{value}</p>
    </div>
  );
}

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// Icons
function BackIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}

function NoteIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

function TaskIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  );
}

export default ClientDetail;
