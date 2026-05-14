'use client';

/**
 * Phase M.3.2: Cloud Scheduler Management Page
 *
 * Admin UI for viewing and managing Cloud Scheduler jobs.
 * Shows the CDR lifecycle job and allows admins to pause, resume, or run
 * jobs manually without leaving the admin portal.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AdminHeader } from '@/components/admin/layout/AdminHeader';
import { AdminCard, AdminCardHeader } from '@/components/admin/ui/AdminCard';
import { AdminTable } from '@/components/admin/ui/AdminTable';
import { AdminButton } from '@/components/admin/ui/AdminButton';
import { AdminBadge } from '@/components/admin/ui/AdminBadge';
import { AdminFeatureGate } from '@/components/admin/AdminFeatureGate';
import { safeAdminFetch } from '@/lib/admin/safeFetch';

interface SchedulerJob {
  name: string;
  displayName: string;
  schedule: string;
  timeZone: string;
  state: string;
  lastAttemptTime: string | null;
  nextRunTime: string | null;
  targetUri: string | null;
  httpMethod: string;
  description: string;
}

interface SchedulerData {
  jobs: SchedulerJob[];
  available: boolean;
  consoleUrl: string;
}

interface PortalAlertSweepResult {
  success?: boolean;
  orgsProcessed?: number;
  clientsProcessed?: number;
  clientsSkipped?: number;
  alertsCreated?: number;
  alertsUpdated?: number;
  alertsResolved?: number;
  durationMs?: number;
  dryRun?: boolean;
  errors?: { organizationClientId: string; message: string }[];
  runBy?: string;
}

export default function SchedulerPage() {
  const [data, setData] = useState<SchedulerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Portal alert sweep — manual trigger (Phase 32B PR3 post-#9b polish).
  const [sweepDryRun, setSweepDryRun] = useState(true);
  const [sweepRunning, setSweepRunning] = useState(false);
  const [sweepResult, setSweepResult] = useState<PortalAlertSweepResult | null>(null);
  const [sweepError, setSweepError] = useState<string | null>(null);

  const handleRunSweep = async () => {
    setSweepRunning(true);
    setSweepError(null);
    setSweepResult(null);
    const result = await safeAdminFetch<PortalAlertSweepResult>('/api/admin/portal-alert-sweep', {
      method: 'POST',
      body: JSON.stringify({ dryRun: sweepDryRun }),
    });
    if (result.ok && result.data) {
      setSweepResult(result.data);
    } else {
      setSweepError(result.error || 'Failed to run portal alert sweep');
    }
    setSweepRunning(false);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await safeAdminFetch<SchedulerData>('/api/admin/gcp/scheduler');
    if (result.ok && result.data) {
      setData(result.data);
    } else {
      setError(result.error || 'Failed to fetch scheduler data');
    }
    setLoading(false);
  }, []);

  const handleAction = async (action: 'pause' | 'resume' | 'run', jobName: string) => {
    setActionLoading(jobName + action);
    const result = await safeAdminFetch('/api/admin/gcp/scheduler', {
      method: 'POST',
      body: JSON.stringify({ action, jobName }),
    });
    if (result.ok) {
      await fetchData();
    } else {
      setError(result.error || `Failed to ${action} job`);
    }
    setActionLoading(null);
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getStateBadge = (state: string) => {
    switch (state) {
      case 'ENABLED':
        return <AdminBadge variant="success" size="sm">Enabled</AdminBadge>;
      case 'PAUSED':
        return <AdminBadge variant="warning" size="sm">Paused</AdminBadge>;
      case 'DISABLED':
        return <AdminBadge variant="neutral" size="sm">Disabled</AdminBadge>;
      case 'UPDATE_FAILED':
        return <AdminBadge variant="error" size="sm">Failed</AdminBadge>;
      default:
        return <AdminBadge variant="neutral" size="sm">{state}</AdminBadge>;
    }
  };

  return (
    <AdminFeatureGate feature="adminPortalEnabled">
      <AdminHeader
        title="Cloud Scheduler"
        description="Manage scheduled jobs (CDR lifecycle, etc.) via Cloud Scheduler API"
        action={
          <div className="flex gap-2">
            {data?.consoleUrl && (
              <a href={data.consoleUrl} target="_blank" rel="noopener noreferrer">
                <AdminButton variant="outline">Open in GCP Console</AdminButton>
              </a>
            )}
            <AdminButton onClick={fetchData} variant="outline">
              Refresh
            </AdminButton>
          </div>
        }
      />

      {error && (
        <AdminCard className="mb-4">
          <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        </AdminCard>
      )}

      {/* Portal alert sweep — runs the same recompute as the
          `monitrax-portal-alert-sweep` Cloud Scheduler job, on demand.
          Works independently of the GCP Scheduler API (this calls the
          app endpoint directly), so it's outside the data-load block. */}
      <AdminCard className="mb-4">
        <AdminCardHeader
          title="Portal alert sweep"
          description="Recompute every org's Practice 'needs attention' alert stream from each active client's current snapshot. Same work as the daily Cloud Scheduler job (monitrax-portal-alert-sweep, 0 4 * * * UTC) — use this before the scheduler job is wired, or after onboarding a new client."
        />
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 select-none">
            <input
              type="checkbox"
              checked={sweepDryRun}
              onChange={(e) => setSweepDryRun(e.target.checked)}
              disabled={sweepRunning}
              className="h-4 w-4 rounded border-gray-300"
            />
            Dry run (compute only — write nothing)
          </label>
          <AdminButton onClick={handleRunSweep} isLoading={sweepRunning} disabled={sweepRunning}>
            {sweepDryRun ? 'Preview sweep' : 'Run sweep now'}
          </AdminButton>
          {!sweepDryRun && (
            <span className="text-xs text-amber-600 dark:text-amber-400">
              Writes ClientAlert rows for all orgs.
            </span>
          )}
        </div>

        {sweepError && (
          <div className="mt-3 text-sm text-red-600 dark:text-red-400">{sweepError}</div>
        )}

        {sweepResult && (
          <div className="mt-4 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-sm">
            <div className="flex items-center gap-2 mb-2">
              <AdminBadge variant={sweepResult.dryRun ? 'neutral' : 'success'} size="sm">
                {sweepResult.dryRun ? 'Dry run' : 'Applied'}
              </AdminBadge>
              {typeof sweepResult.durationMs === 'number' && (
                <span className="text-xs text-gray-500">{sweepResult.durationMs} ms</span>
              )}
              {sweepResult.runBy && (
                <span className="text-xs text-gray-500">· run by {sweepResult.runBy}</span>
              )}
            </div>
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1">
              <div><dt className="text-xs text-gray-500">Orgs</dt><dd className="font-medium">{sweepResult.orgsProcessed ?? 0}</dd></div>
              <div><dt className="text-xs text-gray-500">Clients processed</dt><dd className="font-medium">{sweepResult.clientsProcessed ?? 0}</dd></div>
              <div><dt className="text-xs text-gray-500">Clients skipped</dt><dd className="font-medium">{sweepResult.clientsSkipped ?? 0}</dd></div>
              <div><dt className="text-xs text-gray-500">Alerts created</dt><dd className="font-medium">{sweepResult.alertsCreated ?? 0}</dd></div>
              <div><dt className="text-xs text-gray-500">Alerts updated</dt><dd className="font-medium">{sweepResult.alertsUpdated ?? 0}</dd></div>
              <div><dt className="text-xs text-gray-500">Alerts resolved</dt><dd className="font-medium">{sweepResult.alertsResolved ?? 0}</dd></div>
              <div><dt className="text-xs text-gray-500">Errors</dt><dd className={`font-medium ${(sweepResult.errors?.length ?? 0) > 0 ? 'text-amber-600 dark:text-amber-400' : ''}`}>{sweepResult.errors?.length ?? 0}</dd></div>
            </dl>
            {sweepResult.errors && sweepResult.errors.length > 0 && (
              <ul className="mt-2 list-disc list-inside text-xs text-amber-600 dark:text-amber-400 space-y-0.5">
                {sweepResult.errors.slice(0, 10).map((e, i) => (
                  <li key={i}>{e.organizationClientId}: {e.message}</li>
                ))}
                {sweepResult.errors.length > 10 && <li>…and {sweepResult.errors.length - 10} more</li>}
              </ul>
            )}
          </div>
        )}
      </AdminCard>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-500">Loading scheduler jobs...</div>
        </div>
      ) : data && (
        <>
          {!data.available && (
            <AdminCard className="mb-4 border-yellow-500 border">
              <div className="flex items-start gap-3 text-yellow-700 dark:text-yellow-400">
                <svg className="w-5 h-5 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="font-medium">Cloud Scheduler API not configured</p>
                  <p className="text-sm mt-1">Set GCS_SERVICE_ACCOUNT_KEY and GCP_PROJECT_ID environment variables to enable scheduler management. Use the GCP Console link above to manage jobs directly.</p>
                </div>
              </div>
            </AdminCard>
          )}

          <AdminCard>
            <AdminCardHeader
              title="Scheduled Jobs"
              description={`${data.jobs.length} jobs configured`}
            />
            {data.jobs.length > 0 ? (
              <AdminTable
                columns={[
                  {
                    key: 'displayName',
                    header: 'Job Name',
                    render: (j: SchedulerJob) => (
                      <div>
                        <p className="font-medium">{j.displayName}</p>
                        {j.description && (
                          <p className="text-xs text-gray-500">{j.description}</p>
                        )}
                      </div>
                    ),
                  },
                  {
                    key: 'schedule',
                    header: 'Schedule',
                    render: (j: SchedulerJob) => (
                      <div>
                        <span className="font-mono text-sm">{j.schedule}</span>
                        <p className="text-xs text-gray-500">{j.timeZone}</p>
                      </div>
                    ),
                  },
                  {
                    key: 'state',
                    header: 'Status',
                    render: (j: SchedulerJob) => getStateBadge(j.state),
                  },
                  {
                    key: 'lastAttemptTime',
                    header: 'Last Run',
                    render: (j: SchedulerJob) =>
                      j.lastAttemptTime
                        ? new Date(j.lastAttemptTime).toLocaleString('en-AU')
                        : <span className="text-gray-400">Never</span>,
                  },
                  {
                    key: 'nextRunTime',
                    header: 'Next Run',
                    render: (j: SchedulerJob) =>
                      j.nextRunTime
                        ? new Date(j.nextRunTime).toLocaleString('en-AU')
                        : <span className="text-gray-400">—</span>,
                  },
                  {
                    key: 'actions',
                    header: 'Actions',
                    render: (j: SchedulerJob) => (
                      <div className="flex gap-2">
                        {j.state === 'ENABLED' && (
                          <AdminButton
                            size="sm"
                            variant="outline"
                            onClick={() => handleAction('pause', j.name)}
                            isLoading={actionLoading === j.name + 'pause'}
                          >
                            Pause
                          </AdminButton>
                        )}
                        {j.state === 'PAUSED' && (
                          <AdminButton
                            size="sm"
                            variant="outline"
                            onClick={() => handleAction('resume', j.name)}
                            isLoading={actionLoading === j.name + 'resume'}
                          >
                            Resume
                          </AdminButton>
                        )}
                        <AdminButton
                          size="sm"
                          onClick={() => handleAction('run', j.name)}
                          isLoading={actionLoading === j.name + 'run'}
                        >
                          Run Now
                        </AdminButton>
                      </div>
                    ),
                  },
                ]}
                data={data.jobs}
                keyExtractor={(j) => j.name}
              />
            ) : (
              <p className="text-gray-500 text-center py-4">
                No scheduler jobs found.
                {data.consoleUrl && (
                  <span className="block mt-2">
                    <a href={data.consoleUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      Create jobs in GCP Console →
                    </a>
                  </span>
                )}
              </p>
            )}
          </AdminCard>
        </>
      )}
    </AdminFeatureGate>
  );
}
