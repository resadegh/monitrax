/**
 * MON-087 Ratchet — no Radix <SelectItem> may carry an empty-string value.
 *
 * Radix UI throws at RENDER time on `<Select.Item value="">` ("A <Select.Item />
 * must have a value prop that is not an empty string") — it crashed the
 * property-context Add Expense dialog to the app error boundary (VR-014).
 * The class existed at 15 sites; all were converged to either a plain
 * disabled <div> row ("No X available") or a non-empty sentinel
 * ('ALL' / 'NONE') mapped back to ''/null in the handler.
 *
 * This scan is the lowest implementable ring for the class (no react-mount
 * harness in the repo): the defect is fully static — an empty-value item in
 * source IS the crash — so a source scan catches every current and future
 * instance on every entry point, which a single mounted-dialog smoke test
 * would not.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const SCAN_DIRS = ['app', 'components'];
const SKIP = [/node_modules/, /\.next/, /\.test\./, /\.spec\./];

/** Matches value="" / value={''} / value={""} / value={``} on a SelectItem. */
const EMPTY_VALUE_ITEM =
  /<SelectItem[^>]*\bvalue=(?:""|''|\{\s*(?:""|''|``)\s*\})/;

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (SKIP.some((p) => p.test(full))) continue;
    if (e.isDirectory()) walk(full, out);
    else if (/\.tsx$/.test(e.name)) out.push(full);
  }
  return out;
}

describe('MON-087 — Radix SelectItem empty-value ban (render-crash class)', () => {
  it('no <SelectItem value=""> exists anywhere in app/ or components/', () => {
    const offenders: string[] = [];
    for (const dir of SCAN_DIRS) {
      for (const file of walk(join(ROOT, dir))) {
        const lines = readFileSync(file, 'utf8').split('\n');
        lines.forEach((line, i) => {
          if (EMPTY_VALUE_ITEM.test(line)) offenders.push(`${relative(ROOT, file)}:${i + 1}  ${line.trim().slice(0, 120)}`);
        });
      }
    }
    expect(
      offenders,
      `Empty-string SelectItem value(s) found — Radix throws at render (MON-087).\n` +
        `Use a plain disabled <div> row for "no options", or a non-empty sentinel ` +
        `('ALL'/'NONE') mapped back to ''/null in onValueChange:\n${offenders.join('\n')}`,
    ).toHaveLength(0);
  });
});
