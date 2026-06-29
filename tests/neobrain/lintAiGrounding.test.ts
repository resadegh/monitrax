import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
// @ts-expect-error — pure-Node ESM lint script, no types
import { lintAiGrounding, REGISTRY, ALLOWLIST } from '../../scripts/lint-ai-grounding.mjs';

/**
 * Neobrain Phase B.2 — the bypass-proof grounding gate, pinned as a test so the
 * gate can never silently rot. If a new AI text-generation surface lands without
 * being registered (grounded) or allowlisted (with a reason), the real tree walk
 * fails here AND in `npm run lint:ai-grounding` (vercel-build), turning "every AI
 * surface that narrates money is grounded" into a build fact, not a claim.
 */

describe('lint:ai-grounding gate', () => {
  it('passes over the real tree — every AI-call file is grounded or allowlisted', () => {
    const r = lintAiGrounding();
    // Surface the actual errors if it fails, so CI output is actionable.
    expect(r.errors, r.errors.join('\n')).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it('has no stale registry/allowlist entries (every listed file still makes an AI call)', () => {
    const r = lintAiGrounding();
    expect(r.stale, `stale entries: ${r.stale.join(', ')}`).toEqual([]);
  });

  it('REGISTRY and ALLOWLIST are disjoint — a file is grounded XOR exempt, never both', () => {
    const overlap = Object.keys(REGISTRY).filter((f) => f in ALLOWLIST);
    expect(overlap, `files in both REGISTRY and ALLOWLIST: ${overlap.join(', ')}`).toEqual([]);
  });

  it('every registered grounding marker is actually present in its file today', () => {
    for (const [file, markers] of Object.entries(REGISTRY) as [string, string[]][]) {
      const src = readFileSync(resolve(__dirname, '../../', file), 'utf8');
      const present = (markers as string[]).some((m) => src.includes(m));
      expect(present, `${file}: none of [${(markers as string[]).join(', ')}] present`).toBe(true);
    }
  });

  it('every allowlist entry carries a non-empty reason', () => {
    for (const [file, reason] of Object.entries(ALLOWLIST) as [string, string][]) {
      expect((reason as string).trim().length, `${file} has empty reason`).toBeGreaterThan(10);
    }
  });
});
