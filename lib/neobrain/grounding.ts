/**
 * Neobrain — the grounding validator (Phase 54 §15 Phase B).
 *
 * The one rule (§15.2): every figure the Gemini agent emits is a typed
 * REFERENCE into the FactPack; the server resolves it; any number NOT backed by
 * a resolvable, non-`absent` fact is rejected. The AI never types a bare number,
 * and a fact that isn't present is refused — never estimated.
 *
 * This generalises the proven CFO mechanism (`lib/cfo/aiAdvisor.ts:
 * resolveSnapshotPath`, which drops evidence whose `snapshotPath` doesn't
 * resolve) into ONE resolver over the FactPack — no second source (§12.2.1).
 * Phase C/D point the AI surfaces at this; the `lint:ai-grounding` build gate
 * (Phase B.2, after the Vertex gateway lands) makes routing through it
 * mandatory.
 */
import { formatCurrency, formatPercentageValue } from '@/lib/utils/formatters';
import type { Fact, FactPack } from '@/lib/neobrain/factPack';

/** A number the AI claimed, keyed by the ref it cited. */
export interface ClaimedRef {
  ref: string;
}

export interface GroundingResult {
  /** Refs that resolved to a real, non-absent fact — safe to render. */
  resolved: Array<{ ref: string; fact: Fact; rendered: string }>;
  /** Refs the AI cited that DON'T resolve to a real fact — must be stripped. */
  rejected: Array<{ ref: string; reason: 'unknown' | 'absent' | 'non-numeric' }>;
  /** True when every claimed ref resolved (nothing rejected). */
  ok: boolean;
}

/**
 * Resolve a ref (a fact `ref` or `key`) to its Fact, or null if the FactPack
 * has no such fact. Pure.
 */
export function resolveFactRef(pack: FactPack, ref: string): Fact | null {
  if (!ref) return null;
  for (const f of pack.facts) {
    if (f.ref === ref || f.key === ref) return f;
  }
  return null;
}

/** Render a resolved fact to its display string by unit (SSOT formatters). */
export function renderFact(fact: Fact): string {
  if (fact.state === 'absent' || fact.value === null) return '—';
  switch (fact.unit) {
    case 'AUD':
      return formatCurrency(fact.value);
    case 'percent':
      return formatPercentageValue(fact.value, { decimals: 1 });
    case 'months':
      return `${fact.value.toFixed(1)} months`;
    case 'days':
      return `${Math.round(fact.value)} days`;
    case 'ratio':
      return fact.value.toFixed(2);
    case 'count':
      return String(Math.round(fact.value));
    case 'flag':
      return fact.value ? 'yes' : 'no';
    default:
      return String(fact.value);
  }
}

/**
 * The validator. Given the FactPack the response was grounded on and the refs
 * the AI cited, partition them into resolved (safe) and rejected (hallucinated
 * / unavailable). A ref is rejected when it: is unknown to the pack, resolves
 * to an `absent` fact ("not connected" — the AI must refuse, not invent), or
 * resolves to a non-numeric fact when a number was expected.
 *
 * This is the anti-hallucination guarantee: a number the AI cites that this
 * function rejects must never reach the user.
 */
export function validateGroundedNumbers(
  pack: FactPack,
  claimed: Array<ClaimedRef | string>,
): GroundingResult {
  const resolved: GroundingResult['resolved'] = [];
  const rejected: GroundingResult['rejected'] = [];

  for (const c of claimed) {
    const ref = typeof c === 'string' ? c : c.ref;
    const fact = resolveFactRef(pack, ref);
    if (!fact) {
      rejected.push({ ref, reason: 'unknown' });
      continue;
    }
    if (fact.state === 'absent' || fact.value === null) {
      rejected.push({ ref, reason: 'absent' });
      continue;
    }
    if (!Number.isFinite(fact.value)) {
      rejected.push({ ref, reason: 'non-numeric' });
      continue;
    }
    resolved.push({ ref, fact, rendered: renderFact(fact) });
  }

  return { resolved, rejected, ok: rejected.length === 0 };
}

/**
 * Build the system-prompt grounding clause for a FactPack — the instruction the
 * Gemini agent receives so it cites refs instead of inventing numbers. Lists
 * the available refs + their state; instructs refuse-never-estimate.
 *
 * (Phase C wires this into the gateway; here it's the canonical text so every
 * surface uses the same contract.)
 */
export function buildGroundingClause(pack: FactPack): string {
  const lines = pack.facts.map((f) => {
    const status =
      f.state === 'absent'
        ? 'NOT AVAILABLE — say you do not have this; never estimate it'
        : `available (ref: ${f.ref})`;
    return `- ${f.label} [${f.key}]: ${status}`;
  });
  return [
    'GROUNDING RULES (non-negotiable):',
    '1. Every number you state MUST reference one of the facts below by its ref.',
    '2. Never write a number that is not backed by a ref. The server resolves refs to the real value.',
    '3. If a fact is NOT AVAILABLE, say so plainly and suggest the one action to unlock it — never estimate.',
    `4. Figures are "as of" ${pack.snapshotAsOf ?? 'unknown'}${pack.anyStale ? ' (some data is stale — qualify it)' : ''}.`,
    '',
    'AVAILABLE FACTS:',
    ...lines,
  ].join('\n');
}
