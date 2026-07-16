/**
 * lint:ai-grounding — the bypass-proof grounding gate (Neobrain Phase B.2).
 *
 * Every file under lib/+app that makes a user-facing AI text-generation call
 * MUST be either:
 *   • in REGISTRY  — a financial-narrative surface that grounds its numbers;
 *                    the file must still contain ≥1 of its grounding markers
 *                    (so deleting the grounding turns CI red), OR
 *   • in ALLOWLIST — a non-financial-narrative or infrastructure AI call, each
 *                    with a VERIFIED reason.
 * A NEW AI call in an un-listed file fails the build — you must register it
 * (grounded) or allowlist it (with a reason). This is what makes "every AI
 * surface that narrates money is grounded" a build fact, not a claim.
 *
 * Pure Node — runs in CI / vercel-build. Mirrors check-layer0-coverage.mjs.
 * NOTE: file-level granularity (matches lint:financial-surfaces) — a file with
 * one grounded + one un-grounded call passes; the un-grounded one is caught at
 * review. Tighten to per-call only if a real miss appears.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '..');
const ROOTS = ['lib', 'app'];

// A user-facing AI text-generation call. The `[<(]` (not just `(`) is load-
// bearing: many call sites use a generic — `generateGeminiJSONCompletion<T>(…)` —
// so the name is followed by `<`, not `(`. Import/re-export lists have the name
// followed by `,`/newline, so they don't match.
const AI_CALL = /generateGemini(?:JSON|Text)?Completion\s*[<(]|\.generateContent\s*\(|chat\.sendMessage\s*\(/;

// Financial-narrative surfaces — each must keep ≥1 grounding marker.
export const REGISTRY = {
  'lib/cfo/aiAdvisor.ts': ['resolveSnapshotPath', 'renderTaxLawLines'],
  'lib/cashflow-intelligence/geminiSummary.ts': ['groundNarrative'],
  'lib/ai/services/financialAdvisor.ts': ['groundNarrative'],
  'app/api/ai/debt-analysis/route.ts': ['buildEngineProjections'],
  'app/api/budget-analysis/generate/route.ts': ['validateVariableExpenseResponse'],
  'app/api/cfo/advice/chat/route.ts': ['groundNarrative'],
  // Phase 59: rental-statement extraction — every figure validated against the
  // statement text (refuse-never-estimate); ungrounded parses are rejected.
  'lib/neobrain/rentalStatement.ts': ['groundRentalStatementParse'],
};

// Non-financial-narrative or infrastructure AI calls — exempt, each with a reason.
export const ALLOWLIST = {
  'lib/ai/google/geminiClient.ts': 'AI client infrastructure — the canonical chokepoint, not a surface.',
  'lib/ai/gemini.ts': 'Duplicate AI client (Phase-D dedup target) — infrastructure, not a surface.',
  'lib/categorisation/kb/geminiOnMiss.ts': 'Categorisation-on-miss — category label, not a narrative.',
  'lib/documents/intelligence/analyzers/aiDocumentAnalyzer.ts': 'Document field extraction (confidencePolicy) — not a financial narrative.',
  'lib/integrations/trust-deed/geminiExtractor.ts': 'Trust-deed field extraction — structured, not a narrative.',
  'app/api/documents/analyze-for-form/route.ts': 'Form-field extraction — not a financial narrative.',
  'lib/ai/tax-advisor/providers/geminiProvider.ts': 'Tax advisor — tool-grounded multi-turn; answers grounded by the tax-engine TOOLS it calls.',
  'lib/ai/strategyEnhancer.ts': 'SUSPECTED DEAD (no frontend caller found, 2026-06-29) — pending Reza dead-code decision; if kept, must be grounded + moved to REGISTRY.',
};

function listTs(root) {
  const out = [];
  const walk = (dir) => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === 'node_modules' || ent.name === '__tests__') continue;
        walk(p);
      } else if (/\.tsx?$/.test(ent.name) && !ent.name.endsWith('.d.ts')) {
        out.push(relative(ROOT, p));
      }
    }
  };
  walk(resolve(ROOT, root));
  return out;
}

/** Run the gate over the real tree. Returns the verdict; does not exit. */
export function lintAiGrounding() {
  const files = ROOTS.flatMap(listTs);
  const errors = [];
  const aiFiles = [];

  for (const f of files) {
    const src = readFileSync(resolve(ROOT, f), 'utf8');
    if (!AI_CALL.test(src)) continue;
    aiFiles.push(f);
    if (f in REGISTRY) {
      const markers = REGISTRY[f];
      if (!markers.some((m) => src.includes(m))) {
        errors.push(`${f}: registered financial-narrative surface but NONE of its grounding markers [${markers.join(', ')}] is present — grounding removed?`);
      }
    } else if (f in ALLOWLIST) {
      // exempt — reason recorded above
    } else {
      errors.push(`${f}: makes an AI call but is neither REGISTERED (grounded financial surface) nor ALLOWLISTED (with a reason). Add it to scripts/lint-ai-grounding.mjs.`);
    }
  }

  const stale = [...Object.keys(REGISTRY), ...Object.keys(ALLOWLIST)].filter((f) => !aiFiles.includes(f));
  return { ok: errors.length === 0, errors, aiFiles, stale };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const r = lintAiGrounding();
  console.log(`lint:ai-grounding — ${r.aiFiles.length} AI-call file(s) · ${Object.keys(REGISTRY).length} grounded · ${Object.keys(ALLOWLIST).length} allowlisted`);
  if (r.stale.length) console.log(`  note: ${r.stale.length} stale registry/allowlist entr(y/ies) no longer make an AI call — prune: ${r.stale.join(', ')}`);
  if (!r.ok) {
    console.error('✗ lint:ai-grounding FAILED:');
    for (const e of r.errors) console.error('   - ' + e);
    process.exit(1);
  }
  console.log('✓ lint:ai-grounding — every user-facing AI call is a grounded financial surface or an allowlisted exception.');
}
