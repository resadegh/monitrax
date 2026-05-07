'use client';

/**
 * Phase 41i — Calculation Audit admin portal page.
 *
 * Per HR-3 (Phase 41 §1 invariant 11): admin-side only. Never a
 * user-facing surface. Reviewers reject any PR that exposes
 * calc-correctness warnings to end users.
 *
 * The page renders:
 *   - Header summary (engines / fixtures / pass / fail / errored)
 *   - Per-category breakdown
 *   - Failed-fixture detail (which assertions failed, when)
 *   - Engine catalogue (every registered engine + its source path)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AdminHeader, SectionHeader } from '@/components/admin/layout/AdminHeader';
import { AdminCard, AdminCardHeader } from '@/components/admin/ui/AdminCard';
import { AdminTable } from '@/components/admin/ui/AdminTable';
import { AdminButton } from '@/components/admin/ui/AdminButton';
import { AdminBadge } from '@/components/admin/ui/AdminBadge';
import { AdminFeatureGate } from '@/components/admin/AdminFeatureGate';

interface FixtureRunResult {
  engineName: string;
  fixtureName: string;
  status: 'PASS' | 'FAIL' | 'ERROR';
  errorMessage?: string;
  failedAssertions?: string[];
  durationMs: number;
}

interface DifferentialReport {
  startedAt: string;
  completedAt: string;
  totalEngines: number;
  totalFixtures: number;
  passed: number;
  failed: number;
  errored: number;
  results: FixtureRunResult[];
}

interface EngineCatalogueItem {
  name: string;
  description: string;
  category: string;
  sourcePath: string;
  fixtureCount: number;
  fixtures: Array<{
    name: string;
    description: string;
    assertionCount: number;
    authoritySource?: string;
  }>;
}

interface AuditApiResponse {
  success: boolean;
  data: {
    report: DifferentialReport;
    catalogue: EngineCatalogueItem[];
    engineCount: number;
    fixtureCount: number;
    persistence?: { created: number; refreshed: number } | null;
    countsByResolution?: Record<string, number> | null;
  };
}

type FindingResolution =
  | 'OPEN'
  | 'INVESTIGATING'
  | 'FALSE_POSITIVE'
  | 'FIX_REQUIRED'
  | 'FIXED';

interface Finding {
  id: string;
  detectedAt: string;
  source: 'L1_DIFFERENTIAL' | 'L3_ON_DEMAND' | 'L2_ANOMALY' | 'L4_SURFACE_AUDIT';
  engineName: string;
  fixtureName: string | null;
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  resolution: FindingResolution;
  summary: string;
  failedAssertions: string[] | null;
  errorMessage: string | null;
  adminNotes: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  userId: string | null;
}

// Phase 41i.6c — Full Scan progress event shape (mirrors
// `lib/calc-audit/surfaceAudit.ts:FullScanProgress`).
interface FullScanProgressEvent {
  type: 'PROGRESS' | 'DONE' | 'ERROR';
  userIndex?: number;
  userTotal?: number;
  userId?: string;
  outcomes?: Array<{
    surfaceId: string;
    outcome: 'OK' | 'FINDING' | 'SKIPPED';
    severity?: string;
    summary?: string;
    canonicalValue?: number | null;
  }>;
  totals?: {
    usersScanned: number;
    surfacesScanned: number;
    findingsCreated: number;
    findingsRefreshed: number;
    skipped: number;
    errors: number;
  };
  message?: string;
}

export default function CalcAuditPage() {
  const [report, setReport] = useState<DifferentialReport | null>(null);
  const [catalogue, setCatalogue] = useState<EngineCatalogueItem[]>([]);
  const [persistence, setPersistence] = useState<{ created: number; refreshed: number } | null>(null);
  const [countsByResolution, setCountsByResolution] = useState<Record<string, number> | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Phase 41i.3b — Per-user audit state ("Audit this user")
  const [userAuditInput, setUserAuditInput] = useState('');
  const [userAuditRunning, setUserAuditRunning] = useState(false);
  const [userAuditReport, setUserAuditReport] = useState<{
    report: {
      userId: string;
      outcomes: Array<{
        engineName: string;
        outcome: 'OK' | 'FINDING' | 'SKIPPED';
        severity?: string;
        summary?: string;
        skipReason?: string;
      }>;
      totals: {
        enginesScanned: number;
        findingsCreated: number;
        skipped: number;
        errors: number;
      };
    };
    userEmail: string;
  } | null>(null);
  const [userAuditError, setUserAuditError] = useState<string | null>(null);

  // Phase 41i.6c — Full Scan state + L4 filter chip
  const [sourceFilter, setSourceFilter] = useState<
    'ALL' | 'L1_DIFFERENTIAL' | 'L2_ANOMALY' | 'L3_ON_DEMAND' | 'L4_SURFACE_AUDIT'
  >('ALL');
  const [scanRunning, setScanRunning] = useState(false);
  const [scanProgress, setScanProgress] = useState<{
    userIndex: number;
    userTotal: number;
    findingsCreated: number;
    errors: number;
    skipped: number;
    lastUserId?: string;
  } | null>(null);
  const [scanCompleted, setScanCompleted] = useState<FullScanProgressEvent['totals'] | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const fetchFindings = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/calc-audit/findings');
      if (!r.ok) return;
      const j = (await r.json()) as { data: { findings: Finding[]; total: number } };
      setFindings(j.data.findings ?? []);
    } catch {
      // non-blocking
    }
  }, []);

  const fetchAudit = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/calc-audit');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'Failed to run calc audit');
      }
      const data = (await response.json()) as AuditApiResponse;
      setReport(data.data.report);
      setCatalogue(data.data.catalogue);
      setPersistence(data.data.persistence ?? null);
      setCountsByResolution(data.data.countsByResolution ?? null);
      await fetchFindings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setReport(null);
      setCatalogue([]);
    } finally {
      setLoading(false);
    }
  }, [fetchFindings]);

  const transitionFinding = useCallback(
    async (id: string, toResolution: FindingResolution, adminNotes?: string) => {
      try {
        const r = await fetch(`/api/admin/calc-audit/findings/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ toResolution, adminNotes }),
        });
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j.error?.message || `HTTP ${r.status}`);
        }
        await fetchFindings();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Lifecycle update failed');
      }
    },
    [fetchFindings],
  );

  useEffect(() => {
    void fetchAudit();
  }, [fetchAudit]);

  // Phase 41i.3b — Per-user audit handler. Calls
  // POST /api/admin/calc-audit/audit-user/[userId] and renders the
  // returned report. Refreshes findings list after completion.
  const runUserAudit = useCallback(async () => {
    const userId = userAuditInput.trim();
    if (!userId || userAuditRunning) return;
    setUserAuditRunning(true);
    setUserAuditReport(null);
    setUserAuditError(null);
    try {
      const res = await fetch(`/api/admin/calc-audit/audit-user/${encodeURIComponent(userId)}`, {
        method: 'POST',
      });
      const json = (await res.json()) as
        | {
            success: true;
            data: {
              report: NonNullable<typeof userAuditReport>['report'];
              userEmail: string;
            };
          }
        | { error: { code: string; message: string } };
      if (!res.ok || !('success' in json)) {
        const message = 'error' in json ? json.error.message : `HTTP ${res.status}`;
        setUserAuditError(message);
        return;
      }
      setUserAuditReport(json.data);
      await fetchFindings();
    } catch (err) {
      setUserAuditError(err instanceof Error ? err.message : 'Audit failed');
    } finally {
      setUserAuditRunning(false);
    }
  }, [userAuditInput, userAuditRunning, fetchFindings]);

  // Phase 41i.6c — Full Scan handler. Streams NDJSON progress events
  // and renders live counter. Cancel affordance is v2 per D-41i.6-4.
  const runFullScan = useCallback(async () => {
    if (scanRunning) return;
    setScanRunning(true);
    setScanProgress(null);
    setScanCompleted(null);
    setScanError(null);
    try {
      const res = await fetch('/api/admin/calc-audit/full-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok || !res.body) {
        setScanError(`Full scan failed: HTTP ${res.status}`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let aggregateCreated = 0;
      let aggregateErrors = 0;
      let aggregateSkipped = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line) as FullScanProgressEvent;
            if (event.type === 'PROGRESS' && event.outcomes) {
              for (const o of event.outcomes) {
                if (o.outcome === 'FINDING') {
                  if (o.severity === 'HIGH' || o.severity === 'CRITICAL') aggregateErrors += 1;
                  else aggregateCreated += 1;
                } else if (o.outcome === 'SKIPPED') {
                  aggregateSkipped += 1;
                }
              }
              setScanProgress({
                userIndex: event.userIndex ?? 0,
                userTotal: event.userTotal ?? 0,
                findingsCreated: aggregateCreated,
                errors: aggregateErrors,
                skipped: aggregateSkipped,
                lastUserId: event.userId,
              });
            } else if (event.type === 'DONE') {
              setScanCompleted(event.totals ?? null);
            } else if (event.type === 'ERROR') {
              setScanError(event.message ?? 'Unknown error during scan');
            }
          } catch {
            // Skip malformed line — keep streaming.
          }
        }
      }

      // Refresh findings after scan completes so new L4 entries appear.
      await fetchFindings();
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Full scan failed');
    } finally {
      setScanRunning(false);
    }
  }, [scanRunning, fetchFindings]);

  return (
    <AdminFeatureGate feature="adminPortalEnabled">
      <AdminHeader
        title="Calculation Audit"
        description="Silent admin-side safety net. Re-runs every registered calc engine against reference fixtures. Drift = a code change has caused an engine to produce a different number for the same input. Per HR-3 (CLAUDE.md / Phase 41 §1) this is an admin-only surface — never user-facing."
        action={
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <AdminButton onClick={() => void fetchAudit()} disabled={loading}>
              {loading ? 'Running…' : 'Re-run differential'}
            </AdminButton>
            <AdminButton onClick={() => void runFullScan()} disabled={scanRunning}>
              {scanRunning ? 'Scanning…' : 'Full scan (L4)'}
            </AdminButton>
          </div>
        }
      />

      {error && (
        <AdminCard>
          <div style={{ color: 'var(--admin-color-danger, #dc2626)', padding: '1rem' }}>
            {error}
          </div>
        </AdminCard>
      )}

      {report && (
        <AdminCard>
          <AdminCardHeader title="Differential summary" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', padding: '1rem' }}>
            <SummaryStat label="Engines registered" value={String(report.totalEngines)} />
            <SummaryStat label="Total fixtures" value={String(report.totalFixtures)} />
            <SummaryStat label="Passed" value={String(report.passed)} tone="success" />
            <SummaryStat label="Failed" value={String(report.failed)} tone={report.failed > 0 ? 'danger' : 'neutral'} />
            <SummaryStat label="Errored" value={String(report.errored)} tone={report.errored > 0 ? 'danger' : 'neutral'} />
          </div>
        </AdminCard>
      )}

      {report && (report.failed > 0 || report.errored > 0) && (
        <SectionHeader title="Failures requiring attention" />
      )}

      {report?.results
        .filter((r) => r.status !== 'PASS')
        .map((r) => (
          <AdminCard key={`${r.engineName}-${r.fixtureName}`}>
            <AdminCardHeader title={`${r.engineName} :: ${r.fixtureName}`} />
            <div style={{ padding: '1rem' }}>
              <AdminBadge variant={r.status === 'ERROR' ? 'error' : 'warning'}>
                {r.status}
              </AdminBadge>
              {r.errorMessage && (
                <div style={{ marginTop: '0.5rem', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                  {r.errorMessage}
                </div>
              )}
              {r.failedAssertions && r.failedAssertions.length > 0 && (
                <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
                  {r.failedAssertions.map((a, i) => (
                    <li key={i} style={{ fontSize: '0.9rem' }}>
                      {a}
                    </li>
                  ))}
                </ul>
              )}
              <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', opacity: 0.6 }}>
                Duration: {r.durationMs}ms
              </div>
            </div>
          </AdminCard>
        ))}

      <SectionHeader title="Findings queue" />

      <AdminCard>
        <AdminCardHeader title="Audit this user (Phase 41i.3b — L3 on-demand)" />
        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--admin-color-text-muted, #64748b)', margin: 0 }}>
            Re-runs every registered calc engine for this user with their stored data. Sanity invariants (NaN check, balance-sheet identity, gross ≥ net, etc.) fire findings if violated. Findings flow into the queue below as <code>L3_ON_DEMAND</code>.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input
              type="text"
              value={userAuditInput}
              onChange={(e) => setUserAuditInput(e.target.value)}
              placeholder="userId"
              disabled={userAuditRunning}
              style={{
                flex: '1 1 280px',
                padding: '0.4rem 0.6rem',
                border: '1px solid var(--admin-color-border, #e5e7eb)',
                borderRadius: '0.375rem',
                fontFamily: 'monospace',
                fontSize: '0.875rem',
              }}
            />
            <AdminButton onClick={() => void runUserAudit()} disabled={userAuditRunning || userAuditInput.trim().length === 0}>
              {userAuditRunning ? 'Auditing…' : 'Audit this user'}
            </AdminButton>
          </div>
          {userAuditError && (
            <div style={{ color: 'var(--admin-color-danger, #dc2626)', fontSize: '0.875rem' }}>
              {userAuditError}
            </div>
          )}
          {userAuditReport && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem' }}>
              <div style={{ fontWeight: 600 }}>
                Report for {userAuditReport.userEmail || userAuditReport.report.userId.slice(0, 8) + '…'}
              </div>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <span>Engines: {userAuditReport.report.totals.enginesScanned}</span>
                <span>Findings: {userAuditReport.report.totals.findingsCreated}</span>
                <span>Errors: {userAuditReport.report.totals.errors}</span>
                <span>Skipped: {userAuditReport.report.totals.skipped}</span>
              </div>
              <ul style={{ paddingLeft: '1rem', margin: 0 }}>
                {userAuditReport.report.outcomes.map((o, idx) => (
                  <li key={idx} style={{ fontSize: '0.8125rem' }}>
                    <code>{o.engineName}</code> —{' '}
                    {o.outcome === 'OK' ? (
                      <span style={{ color: 'var(--admin-color-success, #16a34a)' }}>OK</span>
                    ) : o.outcome === 'SKIPPED' ? (
                      <span style={{ color: 'var(--admin-color-text-muted, #64748b)' }}>
                        skipped ({o.skipReason})
                      </span>
                    ) : (
                      <span style={{ color: 'var(--admin-color-danger, #dc2626)' }}>
                        FINDING [{o.severity}] {o.summary}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </AdminCard>

      {(scanProgress || scanCompleted || scanError) && (
        <AdminCard>
          <AdminCardHeader title="Full scan (Phase 41i.6c — L4 surface audit)" />
          <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {scanError && (
              <div style={{ color: 'var(--admin-color-danger, #dc2626)' }}>
                {scanError}
              </div>
            )}
            {scanProgress && !scanCompleted && (
              <>
                <div style={{ fontSize: '0.875rem' }}>
                  Scanning user {scanProgress.userIndex} / {scanProgress.userTotal}
                  {scanProgress.lastUserId && (
                    <span style={{ color: 'var(--admin-color-text-muted, #64748b)', marginLeft: '0.5rem' }}>
                      ({scanProgress.lastUserId.slice(0, 8)}…)
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem' }}>
                  <span>Created: {scanProgress.findingsCreated}</span>
                  <span>Errors: {scanProgress.errors}</span>
                  <span>Skipped: {scanProgress.skipped}</span>
                </div>
              </>
            )}
            {scanCompleted && (
              <>
                <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                  Scan complete
                </div>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.875rem' }}>
                  <span>Users: {scanCompleted.usersScanned}</span>
                  <span>Surfaces: {scanCompleted.surfacesScanned}</span>
                  <span>Findings: {scanCompleted.findingsCreated}</span>
                  <span>Errors: {scanCompleted.errors}</span>
                  <span>Skipped: {scanCompleted.skipped}</span>
                </div>
              </>
            )}
          </div>
        </AdminCard>
      )}

      {/* Phase 41i.6c — Source filter chips. Click to filter the
          findings list by source. Defaults to ALL. */}
      {findings.length > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', padding: '0 1rem 0.5rem' }}>
          {(['ALL', 'L1_DIFFERENTIAL', 'L2_ANOMALY', 'L3_ON_DEMAND', 'L4_SURFACE_AUDIT'] as const).map((s) => {
            const count =
              s === 'ALL' ? findings.length : findings.filter((f) => f.source === s).length;
            const active = sourceFilter === s;
            return (
              <button
                key={s}
                onClick={() => setSourceFilter(s)}
                style={{
                  padding: '0.25rem 0.75rem',
                  borderRadius: '9999px',
                  border: active
                    ? '1px solid var(--admin-color-primary, #2563eb)'
                    : '1px solid var(--admin-color-border, #e5e7eb)',
                  backgroundColor: active
                    ? 'var(--admin-color-primary, #2563eb)'
                    : 'transparent',
                  color: active ? '#fff' : 'inherit',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                {s} ({count})
              </button>
            );
          })}
        </div>
      )}

      {countsByResolution && (
        <AdminCard>
          <AdminCardHeader title="Lifecycle counts" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', padding: '1rem' }}>
            {(['OPEN', 'INVESTIGATING', 'FIX_REQUIRED', 'FIXED', 'FALSE_POSITIVE'] as const).map((s) => (
              <SummaryStat
                key={s}
                label={s}
                value={String(countsByResolution[s] ?? 0)}
                tone={
                  s === 'OPEN' || s === 'FIX_REQUIRED'
                    ? 'danger'
                    : s === 'FIXED'
                    ? 'success'
                    : 'neutral'
                }
              />
            ))}
          </div>
        </AdminCard>
      )}

      {persistence && (persistence.created > 0 || persistence.refreshed > 0) && (
        <AdminCard>
          <div style={{ padding: '1rem', fontSize: '0.85rem' }}>
            Last differential run persisted {persistence.created} new finding(s) and refreshed {persistence.refreshed} existing.
          </div>
        </AdminCard>
      )}

      {findings.length === 0 && (
        <AdminCard>
          <div style={{ padding: '1rem', fontSize: '0.85rem', opacity: 0.7 }}>
            No open findings. The audit system is silent — that's the goal (HR-3).
          </div>
        </AdminCard>
      )}

      {findings
        .filter((f) => sourceFilter === 'ALL' || f.source === sourceFilter)
        .map((f) => (
        <AdminCard key={f.id}>
          <AdminCardHeader title={`${f.engineName} :: ${f.fixtureName ?? '—'}`} />
          <div style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
              <AdminBadge variant={f.resolution === 'OPEN' || f.resolution === 'FIX_REQUIRED' ? 'error' : f.resolution === 'FIXED' ? 'success' : 'warning'}>
                {f.resolution}
              </AdminBadge>
              <AdminBadge variant={f.severity === 'CRITICAL' || f.severity === 'HIGH' ? 'error' : 'neutral'}>
                {f.severity}
              </AdminBadge>
              <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                Detected {new Date(f.detectedAt).toLocaleString()} · source: {f.source}
              </span>
            </div>
            <p style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>{f.summary}</p>
            {f.failedAssertions && f.failedAssertions.length > 0 && (
              <ul style={{ paddingLeft: '1.25rem', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                {f.failedAssertions.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            )}
            {f.adminNotes && (
              <p style={{ fontSize: '0.8rem', opacity: 0.75, marginBottom: '0.5rem' }}>
                <strong>Admin notes:</strong> {f.adminNotes}
              </p>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {f.resolution === 'OPEN' && (
                <>
                  <AdminButton onClick={() => void transitionFinding(f.id, 'INVESTIGATING')}>
                    Investigate
                  </AdminButton>
                  <AdminButton onClick={() => void transitionFinding(f.id, 'FALSE_POSITIVE')}>
                    Mark false positive
                  </AdminButton>
                  <AdminButton onClick={() => void transitionFinding(f.id, 'FIX_REQUIRED')}>
                    Fix required
                  </AdminButton>
                </>
              )}
              {f.resolution === 'INVESTIGATING' && (
                <>
                  <AdminButton onClick={() => void transitionFinding(f.id, 'FIX_REQUIRED')}>
                    Fix required
                  </AdminButton>
                  <AdminButton onClick={() => void transitionFinding(f.id, 'FALSE_POSITIVE')}>
                    Mark false positive
                  </AdminButton>
                </>
              )}
              {f.resolution === 'FIX_REQUIRED' && (
                <AdminButton onClick={() => void transitionFinding(f.id, 'FIXED')}>
                  Mark fixed
                </AdminButton>
              )}
              {(f.resolution === 'FIXED' || f.resolution === 'FALSE_POSITIVE') && (
                <AdminButton onClick={() => void transitionFinding(f.id, 'INVESTIGATING')}>
                  Re-open (regression)
                </AdminButton>
              )}
            </div>
          </div>
        </AdminCard>
      ))}

      <SectionHeader title="Engine catalogue" />

      {Object.entries(groupByCategory(catalogue)).map(([category, engines]) => (
        <AdminCard key={category}>
          <AdminCardHeader title={category} />
          <AdminTable
            data={engines}
            keyExtractor={(row) => row.name}
            columns={[
              { key: 'name', header: 'Engine', render: (row: EngineCatalogueItem) => row.name },
              {
                key: 'sourcePath',
                header: 'Source',
                render: (row: EngineCatalogueItem) => (
                  <code style={{ fontSize: '0.8rem' }}>{row.sourcePath}</code>
                ),
              },
              {
                key: 'fixtureCount',
                header: 'Fixtures',
                render: (row: EngineCatalogueItem) => String(row.fixtureCount),
              },
              {
                key: 'description',
                header: 'Description',
                render: (row: EngineCatalogueItem) => (
                  <span style={{ fontSize: '0.85rem' }}>{row.description}</span>
                ),
              },
            ]}
          />
        </AdminCard>
      ))}
    </AdminFeatureGate>
  );
}

function SummaryStat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'success' | 'danger';
}) {
  const colour =
    tone === 'success'
      ? 'var(--admin-color-success, #15803d)'
      : tone === 'danger'
      ? 'var(--admin-color-danger, #dc2626)'
      : 'var(--admin-color-text, #1f2937)';
  return (
    <div>
      <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>{label}</div>
      <div style={{ fontSize: '1.75rem', fontWeight: 700, color: colour }}>{value}</div>
    </div>
  );
}

function groupByCategory(catalogue: EngineCatalogueItem[]): Record<string, EngineCatalogueItem[]> {
  const out: Record<string, EngineCatalogueItem[]> = {};
  for (const item of catalogue) {
    if (!out[item.category]) out[item.category] = [];
    out[item.category].push(item);
  }
  return out;
}
