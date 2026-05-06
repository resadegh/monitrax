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
  };
}

export default function CalcAuditPage() {
  const [report, setReport] = useState<DifferentialReport | null>(null);
  const [catalogue, setCatalogue] = useState<EngineCatalogueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setReport(null);
      setCatalogue([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAudit();
  }, [fetchAudit]);

  return (
    <AdminFeatureGate feature="adminPortalEnabled">
      <AdminHeader
        title="Calculation Audit"
        description="Silent admin-side safety net. Re-runs every registered calc engine against reference fixtures. Drift = a code change has caused an engine to produce a different number for the same input. Per HR-3 (CLAUDE.md / Phase 41 §1) this is an admin-only surface — never user-facing."
        action={
          <AdminButton onClick={() => void fetchAudit()} disabled={loading}>
            {loading ? 'Running…' : 'Re-run differential'}
          </AdminButton>
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
