#!/usr/bin/env node
/**
 * Phase 41i.6b — Static-analysis pass for inline financial math.
 *
 * W1 extension (2026-06-25): scanning is now LAYER-AWARE — `app/dashboard/`,
 * `app/portal/`, `components/` (surface), `app/api/` (route), and `lib/`
 * (engine). The engine + route layers apply a tightened pattern set so that
 * legitimate engine domain math (`assets − liabilities`, `× 12` annualisation)
 * is NOT flagged while genuine duplicate-source smells (converter
 * re-implementations, declared-cashflow bypasses, thin-route violations) still
 * are. See the `Layer` type doc + docs/audits/SSOT_DUPLICATE_SOURCE_AUDIT_2026_06_25.md §7.1.
 *
 * Walks files under the scan targets looking for four patterns that violate
 * CLAUDE.md §6.1 (canonical-source SSOT) + §6.2 (canonical-utility SSOT) +
 * §12.2 / §19.1 (one cashflow source, actuals-aware):
 *
 *   1. Inline frequency conversion (`income.amount * 12`,
 *      `expense.weekly * 52`) — must use `lib/utils/frequencies.ts`
 *      `toMonthly()` / `toAnnual()`.
 *   2. Inline arithmetic on financial fields (`total.income -
 *      total.expenses`, `revenue - opex`) — must consume the
 *      canonical service result.
 *   3. Hardcoded financial constants (GST rate, super cap, etc.) —
 *      must come from `lib/tax-engine/config/taxYearConfig.ts` or
 *      similar canonical config.
 *
 * Exception annotation:
 *   const monthly = annual / 12; // @financial-math-allowed: UI-only display formatting
 *
 * Annotations are tracked in `.audit/financial-math-exceptions.json`
 * so reviewers can audit accumulated exceptions over time.
 *
 * Exit codes:
 *   0 — no violations (or all violations annotated)
 *   1 — at least one unannotated violation
 *   2 — script error (e.g. couldn't read a file)
 *
 * Per spec doc PHASE_41I_6_SURFACE_AUDIT.md §7. Integrated into
 * `vercel-build` as a pre-build CI gate.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// =============================================================================
// Config
// =============================================================================

const REPO_ROOT = path.resolve(__dirname, '..');

/**
 * Layer of the scanned file — drives WHICH patterns apply (W1, 2026-06-25).
 *
 *   surface — UI (`app/dashboard`, `app/portal`, `components`). MUST never
 *             compute money. All four patterns, loose FREQUENCY.
 *   route   — API routes (`app/api`). MUST be thin wrappers (§12.3) — a route
 *             doing financial math is a smell. All four patterns, but
 *             FREQUENCY tightened to genuine converter re-implementations
 *             (a thin route legitimately annualises a canonical value now and
 *             then; only an enum-switch `toMonthly`/`toAnnual` shadow is a dup).
 *   engine  — calc/service engines (`lib`). These are the SSOT homes that are
 *             SUPPOSED to compute domain math (§12.3): `assets - liabilities`
 *             in the net-worth engine IS the definition, `* 12` annualisation
 *             in the cashflow engine is legitimate. Applying the inline-
 *             arithmetic / hardcoded-constant regexes here is ~70% false
 *             positives (legitimate math + sort comparators + test fixtures).
 *             So the engine layer runs ONLY the two patterns an engine can
 *             genuinely get WRONG in a duplicate-source way:
 *               • DECLARED_CASHFLOW_SOURCE — a §19.1 declared-vs-actual bypass
 *               • FREQUENCY (enum-tightened) — a genuine `toMonthly`/`toAnnual`
 *                 converter re-implemented instead of imported from
 *                 `lib/utils/frequencies.ts`.
 *
 * Measurement (2026-06-25) that drove this split: blanket-extending all four
 * patterns to `lib` flagged 215 matches, ~70% of them legitimate engine
 * domain math. The layer-aware scope keeps the gate signal-rich.
 */
type Layer = 'surface' | 'route' | 'engine';

const SCAN_TARGETS: Array<{ dir: string; layer: Layer }> = [
  { dir: 'app/dashboard', layer: 'surface' },
  { dir: 'app/portal', layer: 'surface' },
  { dir: 'components', layer: 'surface' },
  { dir: 'app/api', layer: 'route' },
  { dir: 'lib', layer: 'engine' },
];

/** Back-compat: the legacy surface-only scan dirs (used by callers/tests that
 *  pass no explicit targets). */
const SCAN_DIRS = SCAN_TARGETS.map((t) => t.dir);

/**
 * Engine-layer files/dirs excluded from the engine scan — either the canonical
 * SSOT home of a pattern (so it doesn't flag its own definition) or audit/test
 * harnesses that carry test fixtures (not production engines). W1, 2026-06-25.
 */
const ENGINE_SCAN_SKIP: RegExp[] = [
  /^lib\/utils\/frequencies\.ts$/, // THE canonical frequency converter (its job)
  /^lib\/calc-audit\//, // decimal-engine audit harnesses + embedded test fixtures
  /^lib\/testing\//, // test/export harness (W6 retire target, tracked in the audit doc)
];

const EXTENSIONS = new Set(['.ts', '.tsx']);

/**
 * Files we explicitly skip — typically test fixtures, migration files,
 * or files that are themselves the canonical source.
 */
const SKIP_PATTERNS = [
  /\.test\.(ts|tsx)$/,
  /\.spec\.(ts|tsx)$/,
  /\.stories\.(ts|tsx)$/,
  /node_modules/,
  /\.next/,
];

const EXCEPTIONS_SIDECAR = path.join(REPO_ROOT, '.audit', 'financial-math-exceptions.json');

/**
 * Baseline of grandfathered violations — pre-existing violations
 * present at the time this lint shipped. Each baseline entry is
 * documented + audit-trailed; new violations not in the baseline
 * fail the build. Resolve baseline entries over time + delete from
 * the JSON when fixed.
 *
 * Regenerate via `BASELINE_REGENERATE=1 npm run lint:financial-surfaces`
 * — use sparingly + with reviewer scrutiny.
 */
const BASELINE_PATH = path.join(REPO_ROOT, '.audit', 'financial-math-baseline.json');

// =============================================================================
// Detectors
// =============================================================================

export interface Violation {
  file: string;
  line: number;
  column: number;
  pattern: 'FREQUENCY_CONVERSION' | 'INLINE_ARITHMETIC' | 'HARDCODED_FINANCIAL_CONSTANT' | 'DECLARED_CASHFLOW_SOURCE';
  match: string;
  /** The full line of source for context. */
  sourceLine: string;
  /** True if the line carries a `@financial-math-allowed` annotation. */
  annotated: boolean;
  /** The annotation reason, if annotated. */
  annotationReason?: string;
}

const ANNOTATION_REGEX = /\/[\/\*]\s*@financial-math-allowed:\s*([^\n*]+?)(?:\*\/|\n|$)/i;

/**
 * Pattern 1 — Inline frequency conversion.
 * Matches: `<identifier>.<word> * 12`, `<identifier>.<word> * 52`,
 * `<identifier>.<word> * 26`, `<identifier>.<word> * 4`, `<word> / 12`,
 * `<word> / 52`, etc. Where `<identifier>.<word>` looks like a financial
 * field (income/expense/amount/total/value).
 *
 * Matches `value * 12` only when the variable name strongly suggests
 * money (avoids false positives on iteration counts).
 */
const FREQUENCY_PATTERNS: Array<{ regex: RegExp; description: string }> = [
  {
    regex: /\b\w*(?:income|expense|amount|revenue|salary|wage|cost|cashflow|earnings|payment)\w*(?:\.\w+)?\s*\*\s*(?:12|52|26|4|365)\b/gi,
    description: 'Inline frequency multiplication on a financial field',
  },
  {
    regex: /\b\w*(?:income|expense|amount|revenue|salary|wage|cost|cashflow|earnings|payment)\w*(?:\.\w+)?\s*\/\s*(?:12|52|26|4|365)\b/gi,
    description: 'Inline frequency division on a financial field',
  },
];

/**
 * Frequency-enum literal — the fingerprint of a `toMonthly`/`toAnnual`
 * RE-IMPLEMENTATION (a `switch (frequency)` / map / ternary chain that
 * multiplies by 12/52/26 per period) as opposed to a one-off legitimate
 * annualisation (`monthlyIncome * 12`) or amortisation (`rate / 12`).
 *
 * In the route + engine layers a FREQUENCY match only counts when the SAME
 * line also names a period — that's what separates a re-implemented converter
 * (a genuine duplicate of `lib/utils/frequencies.ts`) from legitimate engine
 * domain math. Surfaces keep the loose rule (they must never do `* 12` at all).
 * W1, 2026-06-25.
 */
const FREQUENCY_ENUM_LITERAL =
  /(['"])(?:weekly|fortnightly|fortnight|bi-?weekly|monthly|quarterly|annually|annual|yearly|daily)\1|\b(?:WEEKLY|FORTNIGHTLY|BI-?WEEKLY|MONTHLY|QUARTERLY|ANNUALLY|ANNUAL|YEARLY|DAILY)\b/;

/**
 * Pattern 2 — Inline arithmetic on financial fields.
 * Detects expressions like `total.income - total.expenses`,
 * `revenue - opex`, `income.gross - tax`. Both operands must look
 * financial.
 */
const FINANCIAL_FIELD_HINT = /(?:income|expense|revenue|cost|debt|equity|cashflow|profit|loss|tax|salary|wage|payment|liabilities?|assets?|networth|net.worth)/i;

const INLINE_ARITHMETIC_REGEX = /\b(\w+(?:\.\w+)+)\s*([\+\-])\s*(\w+(?:\.\w+)+)/g;

/**
 * Pattern 3 — Hardcoded financial constants.
 * The most common offenders:
 *   - GST rate (0.10 / 10%)
 *   - SMSF tax rate (0.15 / 15%)
 *   - Super contribution caps ($30000 FY24-25, $27500 prior, etc.)
 *   - CGT discount (0.5 / 50%)
 *   - Foreign-resident surcharge (0.04 / 4%)
 *
 * Detected only when the literal appears NEXT TO a financial-field name
 * (avoids false positives on UI percentages or pagination).
 */
const HARDCODED_CONSTANT_REGEX = /\b(?:0\.10|0\.15|0\.50|0\.0837|30000|27500|110000|220000|1\.10)\b/g;

/**
 * Pattern 4 — Declared-cashflow source bypass (CLAUDE.md §12.2 / §19.1).
 *
 * A surface that reads a DECLARED headline-cashflow field directly off a
 * snapshot (`snapshot.cashflow.monthlyNetCashflow`, `.savingsRate`,
 * `.totalIncome`, `.totalExpenses`, `.annualNetCashflow`) is sourcing money
 * numbers from the "plan" side, silently dropping uncategorised actual spend
 * → false-optimistic surplus/savings. Added 2026-06-25 after the dashboard
 * KPI tiles showed +$10,505 while /cashflow + Money Story showed −$20,914.
 *
 * Headline money surfaces MUST read the canonical (actuals-aware) cashflow —
 * the `getCanonicalMonthlyCashflow()` result, surfaced precomputed via the
 * insights payload (`insights.kpiTiles.canonical.*`). The ONE legitimate
 * declared fallback (before the canonical payload loads) carries an
 * `@financial-math-allowed` annotation.
 */
const DECLARED_CASHFLOW_REGEX = /\.cashflow\.(?:monthlyNetCashflow|annualNetCashflow|savingsRate|totalIncome|totalExpenses)\b/g;

// =============================================================================
// Walker
// =============================================================================

function walkDir(dir: string, files: string[] = []): string[] {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (SKIP_PATTERNS.some((p) => p.test(full))) continue;
    if (entry.isDirectory()) {
      walkDir(full, files);
    } else if (EXTENSIONS.has(path.extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

// =============================================================================
// File scanner
// =============================================================================

export function scanFile(
  filePath: string,
  content: string,
  layer: Layer = 'surface',
): Violation[] {
  const violations: Violation[] = [];
  const lines = content.split('\n');

  // Which patterns run in this layer (W1, 2026-06-25 — see the `Layer` doc).
  //   surface → all four, loose FREQUENCY
  //   route   → all four, enum-tightened FREQUENCY
  //   engine  → DECLARED_CASHFLOW_SOURCE + enum-tightened FREQUENCY only
  //             (engines legitimately compute arithmetic + hold domain math)
  const runArithmetic = layer !== 'engine';
  const runConstants = layer !== 'engine';
  const tightenFrequency = layer !== 'surface';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;

    const annotation = line.match(ANNOTATION_REGEX);
    const annotationReason = annotation ? annotation[1].trim() : undefined;

    // Pattern 1 — Frequency.
    // In route + engine layers, a match only counts as a converter
    // re-implementation when the line also names a period — bare `* 12`
    // annualisation / `rate / 12` amortisation is legitimate domain math.
    if (!tightenFrequency || FREQUENCY_ENUM_LITERAL.test(line)) {
      for (const { regex } of FREQUENCY_PATTERNS) {
        regex.lastIndex = 0;
        let m;
        while ((m = regex.exec(line)) !== null) {
          violations.push({
            file: filePath,
            line: lineNo,
            column: m.index + 1,
            pattern: 'FREQUENCY_CONVERSION',
            match: m[0],
            sourceLine: line,
            annotated: !!annotation,
            annotationReason,
          });
        }
      }
    }

    // Pattern 2 — Inline arithmetic on financial fields (surface + route only)
    if (runArithmetic) {
      INLINE_ARITHMETIC_REGEX.lastIndex = 0;
      let arithMatch;
      while ((arithMatch = INLINE_ARITHMETIC_REGEX.exec(line)) !== null) {
        const left = arithMatch[1];
        const right = arithMatch[3];
        // Only flag when BOTH sides look financial — avoids false positives
        // on `node.left - node.right`, `position.x + position.y`, etc.
        // Also skip count/size members (`loans.length + income.length`) and
        // sort comparators (`b.unitCost - a.unitCost`) — these are array
        // bookkeeping, not money arithmetic (W1 precision pass, 2026-06-25).
        const isCountish =
          /\.(?:length|count|size)$/.test(left) || /\.(?:length|count|size)$/.test(right);
        const isSortComparator = /\.sort\s*\(/.test(line);
        if (
          FINANCIAL_FIELD_HINT.test(left) &&
          FINANCIAL_FIELD_HINT.test(right) &&
          !isCountish &&
          !isSortComparator
        ) {
          violations.push({
            file: filePath,
            line: lineNo,
            column: arithMatch.index + 1,
            pattern: 'INLINE_ARITHMETIC',
            match: arithMatch[0],
            sourceLine: line,
            annotated: !!annotation,
            annotationReason,
          });
        }
      }
    }

    // Pattern 4 — Declared-cashflow source bypass (§12.2 / §19.1 SSOT) — all layers
    DECLARED_CASHFLOW_REGEX.lastIndex = 0;
    let cashflowMatch;
    while ((cashflowMatch = DECLARED_CASHFLOW_REGEX.exec(line)) !== null) {
      violations.push({
        file: filePath,
        line: lineNo,
        column: cashflowMatch.index + 1,
        pattern: 'DECLARED_CASHFLOW_SOURCE',
        match: cashflowMatch[0],
        sourceLine: line,
        annotated: !!annotation,
        annotationReason,
      });
    }

    // Pattern 3 — Hardcoded financial constants (surface + route only; only
    // when adjacent to a financial field name on the same line)
    if (runConstants && FINANCIAL_FIELD_HINT.test(line)) {
      HARDCODED_CONSTANT_REGEX.lastIndex = 0;
      let constMatch;
      while ((constMatch = HARDCODED_CONSTANT_REGEX.exec(line)) !== null) {
        violations.push({
          file: filePath,
          line: lineNo,
          column: constMatch.index + 1,
          pattern: 'HARDCODED_FINANCIAL_CONSTANT',
          match: constMatch[0],
          sourceLine: line,
          annotated: !!annotation,
          annotationReason,
        });
      }
    }
  }

  return violations;
}

// =============================================================================
// Sidecar JSON
// =============================================================================

interface ExceptionRecord {
  file: string;
  line: number;
  pattern: string;
  reason: string;
  recordedAt: string;
}

function writeSidecar(annotated: Violation[]): void {
  const dir = path.dirname(EXCEPTIONS_SIDECAR);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const records: ExceptionRecord[] = annotated.map((v) => ({
    file: path.relative(REPO_ROOT, v.file),
    line: v.line,
    pattern: v.pattern,
    reason: v.annotationReason ?? '(no reason provided)',
    recordedAt: new Date().toISOString(),
  }));

  fs.writeFileSync(
    EXCEPTIONS_SIDECAR,
    JSON.stringify({ count: records.length, records }, null, 2) + '\n',
  );
}

// =============================================================================
// CLI runner
// =============================================================================

export interface BaselineEntry {
  file: string;
  line: number;
  pattern: string;
  match: string;
}

export interface RunResult {
  scannedFiles: number;
  violations: Violation[];
  unannotated: Violation[];
  annotated: Violation[];
  /** Violations matching a baseline entry — not failing the build. */
  grandfathered: Violation[];
  /** Unannotated violations NOT matching baseline — these fail. */
  newViolations: Violation[];
  /** Stale baseline entries (in JSON but no longer matching the codebase). */
  staleBaseline: BaselineEntry[];
}

export function loadBaseline(): BaselineEntry[] {
  if (!fs.existsSync(BASELINE_PATH)) return [];
  try {
    const raw = fs.readFileSync(BASELINE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as { entries?: BaselineEntry[] };
    return parsed.entries ?? [];
  } catch {
    return [];
  }
}

function matchesBaseline(v: Violation, baseline: BaselineEntry[]): boolean {
  const rel = path.relative(REPO_ROOT, v.file);
  return baseline.some(
    (b) =>
      b.file === rel &&
      b.line === v.line &&
      b.pattern === v.pattern &&
      b.match === v.match,
  );
}

function isEngineSkipped(file: string): boolean {
  const rel = path.relative(REPO_ROOT, file);
  return ENGINE_SCAN_SKIP.some((p) => p.test(rel));
}

/**
 * @param targets - directories to scan with their layer. Accepts either the
 *   structured `{dir, layer}[]` form (default) or a legacy `string[]` of dirs
 *   (each inferred from SCAN_TARGETS, defaulting to 'surface') for back-compat.
 */
export function runLint(
  targets: Array<{ dir: string; layer: Layer }> | string[] = SCAN_TARGETS,
): RunResult {
  const resolved: Array<{ dir: string; layer: Layer }> =
    typeof targets[0] === 'string'
      ? (targets as string[]).map((dir) => ({
          dir,
          layer: SCAN_TARGETS.find((t) => t.dir === dir)?.layer ?? 'surface',
        }))
      : (targets as Array<{ dir: string; layer: Layer }>);

  const violations: Violation[] = [];
  let scannedCount = 0;
  for (const { dir, layer } of resolved) {
    const files: string[] = [];
    walkDir(path.join(REPO_ROOT, dir), files);
    for (const file of files) {
      // Engine layer skips canonical-source homes + audit/test harnesses.
      if (layer === 'engine' && isEngineSkipped(file)) continue;
      scannedCount++;
      const content = fs.readFileSync(file, 'utf8');
      violations.push(...scanFile(file, content, layer));
    }
  }

  const baseline = loadBaseline();
  const annotated = violations.filter((v) => v.annotated);
  const unannotated = violations.filter((v) => !v.annotated);
  const grandfathered = unannotated.filter((v) => matchesBaseline(v, baseline));
  const newViolations = unannotated.filter((v) => !matchesBaseline(v, baseline));

  // Detect stale baseline entries — listed in JSON but not matching any
  // current violation. These should be removed from the baseline so it
  // shrinks over time as we resolve violations.
  const staleBaseline = baseline.filter(
    (b) =>
      !violations.some(
        (v) =>
          path.relative(REPO_ROOT, v.file) === b.file &&
          v.line === b.line &&
          v.pattern === b.pattern &&
          v.match === b.match,
      ),
  );

  return {
    scannedFiles: scannedCount,
    violations,
    annotated,
    unannotated,
    grandfathered,
    newViolations,
    staleBaseline,
  };
}

function regenerateBaseline(violations: Violation[]): void {
  const dir = path.dirname(BASELINE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const entries: BaselineEntry[] = violations
    .filter((v) => !v.annotated)
    .map((v) => ({
      file: path.relative(REPO_ROOT, v.file),
      line: v.line,
      pattern: v.pattern,
      match: v.match,
    }));

  fs.writeFileSync(
    BASELINE_PATH,
    JSON.stringify(
      {
        comment:
          'Phase 41i.6b — pre-existing financial-math violations grandfathered at the time the lint shipped. Resolve over time + remove the entry. Regenerate via BASELINE_REGENERATE=1 npm run lint:financial-surfaces (with reviewer scrutiny — adding entries here suppresses bugs the lint is designed to catch).',
        generatedAt: new Date().toISOString(),
        count: entries.length,
        entries,
      },
      null,
      2,
    ) + '\n',
  );
}

function formatViolation(v: Violation): string {
  const rel = path.relative(REPO_ROOT, v.file);
  return `  ${rel}:${v.line}:${v.column}  [${v.pattern}]  ${v.match.trim()}\n      ${v.sourceLine.trim()}`;
}

function main(): void {
  if (process.env.BASELINE_REGENERATE === '1') {
    const result = runLint();
    regenerateBaseline(result.violations);
    console.log(
      `[Phase 41i.6b] Regenerated baseline at ${path.relative(REPO_ROOT, BASELINE_PATH)} — ${result.unannotated.length} grandfathered violation(s) recorded.`,
    );
    console.log(
      '[Phase 41i.6b] These entries suppress the build-fail. Resolve them over time + remove the matching entries to shrink the baseline.',
    );
    process.exit(0);
  }

  const result = runLint();

  console.log(
    `[Phase 41i.6b] Scanned ${result.scannedFiles} files; ${result.violations.length} matches (${result.annotated.length} annotated, ${result.grandfathered.length} grandfathered, ${result.newViolations.length} new).`,
  );

  if (result.annotated.length > 0) {
    writeSidecar(result.annotated);
    console.log(
      `[Phase 41i.6b] Recorded ${result.annotated.length} annotated exception(s) to ${path.relative(REPO_ROOT, EXCEPTIONS_SIDECAR)}.`,
    );
  }

  if (result.staleBaseline.length > 0) {
    console.warn(
      `\n[Phase 41i.6b] ⚠ ${result.staleBaseline.length} stale baseline entry/entries (no longer match the codebase — please remove from ${path.relative(REPO_ROOT, BASELINE_PATH)}):`,
    );
    for (const s of result.staleBaseline) {
      console.warn(`  ${s.file}:${s.line}  [${s.pattern}]  ${s.match}`);
    }
  }

  if (result.newViolations.length === 0) {
    console.log(
      '\n[Phase 41i.6b] ✓ No new financial-math violations. Build proceeds.',
    );
    if (result.grandfathered.length > 0) {
      console.log(
        `[Phase 41i.6b]   (${result.grandfathered.length} grandfathered — see ${path.relative(REPO_ROOT, BASELINE_PATH)})`,
      );
    }
    process.exit(0);
  }

  console.error(
    '\n[Phase 41i.6b] ✗ NEW financial-math violations found (not in baseline):\n',
  );
  for (const v of result.newViolations) {
    console.error(formatViolation(v));
  }
  console.error(`
[Phase 41i.6b] Each violation must either:
  (a) Be replaced with a call to the canonical source
      (e.g. \`getMasterFinancialSnapshot()\`, \`toMonthly()\`,
      \`taxYearConfig.SUPER_CONCESSIONAL_CAP\`).
  (b) Carry an exception annotation on the same line:
      \`/* @financial-math-allowed: <reason> */\`.
  (c) Be moved out of the surface layer into a service/calc engine.

See \`docs/blueprint/PHASE_41I_6_SURFACE_AUDIT.md\` §7.
`);
  process.exit(1);
}

// Only run main() when invoked as a CLI (not when imported by tests)
if (require.main === module) {
  main();
}
