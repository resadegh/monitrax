/**
 * NeoAudit Release Scorecard — unit tests for the publish-gate summary logic.
 */
import { describe, it, expect } from 'vitest';
import { summarizeScorecard, type RegistryIssue } from '@/lib/verification/scorecard';

const mk = (id: string, status: string, changesNumbers: boolean): RegistryIssue => ({
  id,
  title: `${id} title`,
  status,
  changesNumbers,
});

describe('summarizeScorecard', () => {
  it('counts only number-changing issues that are not yet VERIFIED/CLOSED', () => {
    const s = summarizeScorecard([
      mk('MON-1', 'OPEN', true), // open number issue ✓
      mk('MON-2', 'FIXING', true), // open number issue ✓
      mk('MON-3', 'DIAGNOSED', true), // open number issue ✓
      mk('MON-4', 'VERIFIED', true), // resolved — excluded
      mk('MON-5', 'CLOSED', true), // resolved — excluded
      mk('MON-6', 'OPEN', false), // open but NOT number-changing — excluded from the blocker count
      mk('MON-7', 'WONTFIX', true), // not unverified — excluded
    ]);
    expect(s.openNumberIssueCount).toBe(3);
    expect(s.openNumberIssues.map((i) => i.id)).toEqual(['MON-1', 'MON-2', 'MON-3']);
    expect(s.registryClean).toBe(false);
  });

  it('registryClean is true only when zero open number-issues', () => {
    expect(summarizeScorecard([mk('MON-1', 'VERIFIED', true), mk('MON-2', 'OPEN', false)]).registryClean).toBe(true);
    expect(summarizeScorecard([]).registryClean).toBe(true);
  });

  it('totalOpenCount counts every unverified issue regardless of changesNumbers', () => {
    const s = summarizeScorecard([mk('a', 'OPEN', false), mk('b', 'FIXING', true), mk('c', 'CLOSED', true)]);
    expect(s.totalOpenCount).toBe(2);
  });

  it('always names the external checks (never claims them green in-app — §22.2.4)', () => {
    const s = summarizeScorecard([]);
    expect(s.externalChecks.length).toBeGreaterThan(0);
    expect(s.externalChecks.join(' ')).toMatch(/CI/);
  });
});
