/**
 * Issue Registry gate — validates docs/issues/ISSUES.json and ENFORCES the
 * lifecycle so an issue cannot be quietly "closed" while it's still broken
 * elsewhere (CLAUDE.md §19.4 FULL-FLOW VERIFICATION).
 *
 * PURE NODE (no deps) so it runs in `npm run issues:check`, in CI, and inside
 * the vitest gate (tests/issues/registry.test.ts). Returns { errors, warnings }.
 *
 * The load-bearing rules (why this system "actually works"):
 *   - A number-changing issue cannot reach VERIFIED/CLOSED without a LINKED,
 *     EXISTING holistic test (the §19.4 cross-surface propagation test).
 *   - FIXING/VERIFIED/CLOSED require the §19.4 downstream-consumer sweep filled
 *     + a fix PR referenced.
 *   - Every declared Neomatrix `semanticKey` must resolve to a real graph node
 *     (keeps issues tied to the map, not to prose); a number-changing issue at
 *     VERIFIED/CLOSED must carry >=1 resolving key (forces modelling — §21.2.1).
 *   - rootCause anchors must point at files that exist.
 */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '../..');
const REGISTRY = resolve(ROOT, 'docs/issues/ISSUES.json');
const GRAPH = resolve(ROOT, 'docs/financial-logic/graph/financial-graph.json');

const STATUSES = ['OPEN', 'DIAGNOSED', 'FIXING', 'VERIFIED', 'CLOSED', 'WONTFIX', 'RETRACTED'];
const SEVERITIES = ['critical', 'high', 'medium', 'low'];
const ID_RE = /^MON-\d{3,}$/;
const ANCHOR_RE = /^(.+?):(\d+)$/; // path:line
const TERMINAL = new Set(['VERIFIED', 'CLOSED']); // states that require proof
const IN_FLIGHT = new Set(['FIXING', 'VERIFIED', 'CLOSED']); // states that require the sweep + a PR
const STALE_DAYS = 30;

/**
 * Runs the gate. `today` is injected (ISO date) so the check is deterministic.
 * `registry` may be injected (a pre-parsed object) so tests can feed synthetic
 * registries to prove enforcement; otherwise ISSUES.json is read from disk.
 */
export function checkIssues({ today = null, registry = null } = {}) {
  const errors = [];
  const warnings = [];
  const err = (id, m) => errors.push(`${id ? `[${id}] ` : ''}${m}`);
  const warn = (id, m) => warnings.push(`${id ? `[${id}] ` : ''}${m}`);

  let reg = registry;
  if (!reg) {
    if (!existsSync(REGISTRY)) return { errors: [`Registry missing: docs/issues/ISSUES.json`], warnings, count: 0 };
    try {
      reg = JSON.parse(readFileSync(REGISTRY, 'utf8'));
    } catch (e) {
      return { errors: [`ISSUES.json is not valid JSON: ${e.message}`], warnings, count: 0 };
    }
  }

  if (!reg.schemaVersion) err(null, 'schemaVersion missing');
  if (!Array.isArray(reg.issues)) return { errors: [...errors, 'issues[] missing or not an array'], warnings, count: 0 };

  // Neomatrix node ids (for the semanticKey tie).
  let graphNodeIds = new Set();
  if (existsSync(GRAPH)) {
    try {
      graphNodeIds = new Set(JSON.parse(readFileSync(GRAPH, 'utf8')).nodes.map((n) => n.id));
    } catch {
      warn(null, 'financial-graph.json unreadable — skipping semanticKey resolution');
    }
  }

  const seenIds = new Set();
  const REQUIRED = ['id', 'title', 'status', 'severity', 'changesNumbers', 'opened', 'area', 'rootCause', 'semanticKeys', 'downstreamConsumers', 'fixPRs', 'test', 'tracker'];

  for (const it of reg.issues) {
    const id = it.id || '(no id)';

    // ── shape ──
    for (const f of REQUIRED) if (!(f in it)) err(id, `missing field "${f}"`);
    if (!ID_RE.test(it.id || '')) err(id, `id must match MON-NNN`);
    if (seenIds.has(it.id)) err(id, `duplicate id`);
    seenIds.add(it.id);
    if (!STATUSES.includes(it.status)) err(id, `invalid status "${it.status}"`);
    if (!SEVERITIES.includes(it.severity)) err(id, `invalid severity "${it.severity}"`);
    if (typeof it.changesNumbers !== 'boolean') err(id, `changesNumbers must be boolean`);
    for (const arr of ['rootCause', 'semanticKeys', 'downstreamConsumers', 'fixPRs']) {
      if (arr in it && !Array.isArray(it[arr])) err(id, `"${arr}" must be an array`);
    }

    // ── rootCause anchors point at real files ──
    for (const anchor of it.rootCause ?? []) {
      const m = ANCHOR_RE.exec(anchor);
      if (!m) { err(id, `rootCause "${anchor}" must be path:line`); continue; }
      if (!existsSync(resolve(ROOT, m[1]))) err(id, `rootCause file not found: ${m[1]}`);
    }

    // ── Neomatrix tie: declared semanticKeys must resolve ──
    for (const key of it.semanticKeys ?? []) {
      if (graphNodeIds.size && !graphNodeIds.has(key)) {
        err(id, `semanticKey "${key}" is not a Neomatrix node (model it or fix the id — §21.5)`);
      }
    }

    // ── §19.4 lifecycle enforcement ──
    if (IN_FLIGHT.has(it.status)) {
      if (!(it.downstreamConsumers ?? []).length) err(id, `status ${it.status} requires the §19.4 downstream-consumer sweep (downstreamConsumers[] is empty)`);
      if (!(it.fixPRs ?? []).length) err(id, `status ${it.status} requires a fix PR (fixPRs[] is empty)`);
    }
    if (TERMINAL.has(it.status)) {
      if (it.status === 'CLOSED' && !it.closed) err(id, `CLOSED requires a "closed" date`);
      if (it.changesNumbers === true) {
        // The core rule: a number-changing fix cannot close without a holistic test.
        if (!it.test) err(id, `number-changing issue cannot reach ${it.status} without a holistic test (§19.4) — "test" is null`);
        else if (!existsSync(resolve(ROOT, it.test.replace(/#.*$/, '')))) err(id, `linked test not found on disk: ${it.test}`);
        // and >=1 resolving Neomatrix key, so the fix is provably tied to the map
        const resolves = (it.semanticKeys ?? []).some((k) => !graphNodeIds.size || graphNodeIds.has(k));
        if (!(it.semanticKeys ?? []).length || !resolves) err(id, `number-changing issue at ${it.status} must carry >=1 resolving Neomatrix semanticKey (model the number — §21.2.1)`);
      }
    }

    // ── stale warning (non-fatal) ──
    if ((it.status === 'OPEN' || it.status === 'DIAGNOSED') && today && it.opened) {
      const age = (Date.parse(today) - Date.parse(it.opened)) / 86400000;
      if (age > STALE_DAYS) warn(id, `stale — ${Math.round(age)}d in ${it.status} (review or advance)`);
    }
  }

  return { errors, warnings, count: reg.issues.length };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  // Date.now is fine at the CLI boundary (not inside a workflow/cached context).
  const today = new Date().toISOString().slice(0, 10);
  const { errors, warnings, count } = checkIssues({ today });
  for (const w of warnings) console.log(`  ⚠ ${w}`);
  if (errors.length) {
    console.error(`\n✗ Issue registry gate: ${errors.length} error(s) across ${count} issue(s):`);
    for (const e of errors) console.error(`   - ${e}`);
    process.exit(1);
  }
  console.log(`✓ Issue registry gate: ${count} issue(s) valid${warnings.length ? ` (${warnings.length} warning(s))` : ''}.`);
}
