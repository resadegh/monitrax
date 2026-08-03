#!/usr/bin/env node
/**
 * MATRIX RESULT VALIDATOR — makes a verification result machine-consumable.
 *
 * Reza, 2026-08-03: "the matrix should send you the results the way you can
 * consume — make sure this is also built into the handout instructions."
 *
 * The problem this solves is not formatting. It is that a result returned as
 * prose has to be INTERPRETED, and interpretation is where a session assumes.
 * Three concrete near-misses already: a capture accepted before its build
 * precondition was checked (it predated the fix it was measuring), a PASS whose
 * coverage boundary was never stated, and a handout answered against the wrong
 * account. Each is invisible in prose and impossible in the envelope below,
 * because the envelope has a field for it and this script fails without one.
 *
 * Contract: `matrix-result/v1` — see MON-131_COMPLETION_BRIEF.md §3.0c.
 *
 * Usage:
 *   node scripts/verification/check-matrix-result.mjs <file.json>
 *   npm run matrix:check -- <file.json>
 *
 * Exit 0 = the result is well-formed AND self-consistent. It does NOT mean the
 * verification passed — read `verdict` for that. A FAIL result is a valid
 * result; this script only refuses one that cannot be trusted to say either.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SHA_RE = /^[0-9a-f]{40}$/;
const KINDS = ['capture', 'ring3'];
const VERDICTS = ['PASS', 'FAIL', 'CAPTURE_ONLY'];

const errs = [];
const warns = [];
const err = (m) => errs.push(m);
const warn = (m) => warns.push(m);

export function validateMatrixResult(r) {
  errs.length = 0;
  warns.length = 0;

  if (r?.schema !== 'matrix-result/v1') {
    err(`schema must be "matrix-result/v1" (got ${JSON.stringify(r?.schema)})`);
    return { ok: false, errors: [...errs], warnings: [...warns] };
  }

  // ── the handout this answers ──────────────────────────────────────────────
  if (!r.handout) err('handout missing — a result must name the brief it answers');
  else if (!existsSync(resolve(ROOT, r.handout)))
    err(`handout "${r.handout}" does not exist in the repo (§21.2.2 rule 4 — the instrument is committed, not chat-only)`);

  if (!KINDS.includes(r.kind)) err(`kind must be one of ${KINDS.join(' | ')}`);

  // ── the build it ran against ──────────────────────────────────────────────
  // This is the field that would have caught the withdrawn T2 capture: it was
  // taken at 8bed66b6, BEFORE the MON-143 fix it was supposed to reflect.
  // RULE A (Reza, 2026-08-03) — the account-first carve-out. VR-046 F3 surfaced a
  // genuine contradiction between two standing rules: a Ring-3 run MUST be
  // account-first (read Reza's own screens; opening /admin in the same profile is
  // what voided VR-044's first attempt AND VR-046's), yet the deployed commit is
  // exposed ONLY by the admin relay. A compliant account-first run therefore could
  // not satisfy this field. Null sha is now permitted under THREE conditions, all
  // required — the carve-out is narrow by construction, because a run that silently
  // omits its build is exactly the shape that let the withdrawn T2 capture (taken at
  // 8bed66b6, BEFORE the MON-143 fix it claimed to reflect) look valid.
  //   1. kind === 'ring3'      — relay/golden captures READ the relay, so they have
  //                              no excuse; they still require a real sha.
  //   2. sha === null          — explicitly null, never absent/undefined/''. An
  //                              omitted field is an oversight; null is a claim.
  //   3. shaNote states why    — a substantive reason (>= 40 chars), so the gap is
  //                              recorded and auditable rather than waved through.
  const shaNote = typeof r.shaNote === 'string' ? r.shaNote.trim() : '';
  const accountFirstExemption =
    r.kind === 'ring3' && r.sha === null && shaNote.length >= 40;
  if (!accountFirstExemption && !SHA_RE.test(r.sha ?? '')) {
    if (r.sha === null && r.kind === 'ring3') {
      err(
        'sha is null but the account-first exemption is not met — supply a shaNote (>= 40 chars) stating why the deployed commit could not be read',
      );
    } else if (r.sha === null) {
      err(`sha is null, but the account-first exemption applies only to kind:ring3 (this is kind:${r.kind})`);
    } else {
      err('sha must be the full 40-char commit the run executed against (or explicitly null for an account-first ring3 run, with a shaNote)');
    }
  }
  if (!r.capturedAt) err('capturedAt missing (ISO timestamp)');

  // ── identity: admin credentials are not the account under test ────────────
  const ident = r.account?.identityAssertion;
  if (!r.account?.userId) err('account.userId missing — a result not scoped to an account is void');
  if (!ident) err('account.identityAssertion missing — the handout names values to assert BEFORE reading numbers');
  else {
    if (ident.pass !== true)
      err('account.identityAssertion.pass is not true — the payload is void; report the mismatch, not the numbers');
    if (!ident.expected || !ident.observed)
      err('account.identityAssertion needs BOTH expected and observed (a bare pass:true is an assertion about nothing)');
  }

  // ── verdict ───────────────────────────────────────────────────────────────
  if (!VERDICTS.includes(r.verdict)) err(`verdict must be one of ${VERDICTS.join(' | ')}`);
  if (r.kind === 'capture' && r.verdict !== 'CAPTURE_ONLY')
    err('a capture asks for no verdict — use CAPTURE_ONLY (measurements are the deliverable)');
  if (r.kind === 'ring3' && r.verdict === 'CAPTURE_ONLY')
    err('a ring3 run must return PASS or FAIL');

  // ── the checks ────────────────────────────────────────────────────────────
  const checks = Array.isArray(r.checks) ? r.checks : [];
  if (r.kind === 'ring3' && checks.length === 0)
    err('ring3 result has no checks[] — a verification with nothing checked is not a verification');
  checks.forEach((c, i) => {
    const at = `checks[${i}]${c?.id ? ` (${c.id})` : ''}`;
    if (!c?.id) err(`${at}: id missing`);
    if (c?.expected === undefined) err(`${at}: expected missing`);
    if (c?.observed === undefined) err(`${at}: observed missing — "as expected" is not an observation`);
    if (typeof c?.pass !== 'boolean') err(`${at}: pass must be a boolean`);
  });

  // A PASS that contains a failed check is the single most dangerous shape a
  // result can take, because it reads as green.
  const failed = checks.filter((c) => c?.pass === false);
  if (r.verdict === 'PASS' && failed.length)
    err(`verdict PASS but ${failed.length} check(s) failed: ${failed.map((c) => c.id).join(', ')}`);
  if (r.verdict === 'FAIL' && !failed.length && !(r.findings ?? []).length)
    err('verdict FAIL but no failed check and no finding — state what failed');

  // ── capture payload ───────────────────────────────────────────────────────
  if (r.kind === 'capture' && (r.payload === undefined || r.payload === null))
    err('capture result has no payload — the verbatim payload IS the deliverable');

  // ── coverage boundary: refuse a result that implies it verified everything ─
  if (!r.coverage?.verified) err('coverage.verified missing — say exactly what this run establishes');
  if (!r.coverage?.notVerified)
    err('coverage.notVerified missing — §22.2.4: state what this does NOT establish. "Everything" is never the answer');

  // ── findings ──────────────────────────────────────────────────────────────
  (r.findings ?? []).forEach((f, i) => {
    if (!f?.summary) err(`findings[${i}]: summary missing`);
    if (!f?.evidence) warn(`findings[${i}]: no evidence — a finding without evidence is an observation`);
  });
  if (r.verdict === 'PASS' && (r.findings ?? []).some((f) => f?.severity === 'critical'))
    err('verdict PASS with a critical finding — resolve the contradiction before this is consumed');

  return { ok: errs.length === 0, errors: [...errs], warnings: [...warns] };
}

// ── CLI ─────────────────────────────────────────────────────────────────────
const file = process.argv[2];
if (!file) {
  console.error('usage: node scripts/verification/check-matrix-result.mjs <file.json>');
  process.exit(2);
}
if (!existsSync(file)) {
  console.error(`[matrix-result] file not found: ${file}`);
  process.exit(2);
}

let parsed;
try {
  parsed = JSON.parse(readFileSync(file, 'utf8'));
} catch (e) {
  console.error(`[matrix-result] not valid JSON: ${e.message}`);
  process.exit(1);
}

const { ok, errors, warnings } = validateMatrixResult(parsed);
for (const w of warnings) console.warn(`  ⚠ ${w}`);
if (!ok) {
  console.error(`✗ matrix-result invalid — ${errors.length} problem(s):`);
  for (const e of errors) console.error(`  · ${e}`);
  console.error('\nContract: docs/implementation/MON-131_COMPLETION_BRIEF.md §3.0c');
  process.exit(1);
}
console.log(
  // sha may legitimately be null under the Rule A account-first exemption above —
  // `.slice()` on it would throw on the SUCCESS path, turning a valid result into a
  // crash. Surfaced by VR-046 F3 in the same breath as the rule itself.
  `✓ matrix-result well-formed · kind=${parsed.kind} · verdict=${parsed.verdict} · sha=${
    parsed.sha ? parsed.sha.slice(0, 8) : 'null (account-first)'
  } · ${(parsed.checks ?? []).length} check(s)`,
);
