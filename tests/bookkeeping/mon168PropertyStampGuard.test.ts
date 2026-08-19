/**
 * MON-168 guard (§23.2.2 Ratchet, Ring 1) — no code path may set a link
 * target id (incomeId / expenseId / loanId) on a UnifiedTransaction without
 * also resolving `propertyId` in the same write.
 *
 * Why a source-scan test: the 2026-08-19 Ring-3 FAIL on #1595 found 16 write
 * sites across four files that each set target ids and none stamped
 * propertyId — a class defect no unit test on one site can prevent. This scan
 * walks app/ + lib/ and, for every `unifiedTransaction.<write>` call whose
 * data block sets a target id to a NON-null value, requires `propertyId` in
 * the same block. Files that build their data object dynamically must
 * reference the ONE resolver (lib/bookkeeping/propertyLink) instead.
 *
 * Coverage: proves the static shape of every write site at HEAD. Does NOT
 * prove the resolved value is correct (Ring-0 covers the resolver; Ring-3
 * covers live data).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const ROOTS = ['app', 'lib'];
const WRITE_CALL = /unifiedTransaction\.(update|updateMany|create|createMany)\s*\(/g;
// A target id being SET to something other than null (`: true` = a Prisma
// select clause, not a write). The \s* lives INSIDE the lookahead so the
// matcher cannot backtrack around the null/true exclusion.
const SETS_TARGET_ID = /\b(incomeId|expenseId|loanId)\s*:(?!\s*(?:null|true)\b)/;
// `incomeId: body.type === 'income' ? body.targetId : null` style still matches
// SETS_TARGET_ID (the value starts with `body`), which is correct — those
// sites DO link and MUST stamp.

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      walk(p, out);
    } else if (/\.tsx?$/.test(name) && !/\.(test|spec)\./.test(name)) {
      out.push(p);
    }
  }
  return out;
}

interface Violation {
  file: string;
  index: number;
  excerpt: string;
}

describe('MON-168 — every UnifiedTransaction link write stamps propertyId', () => {
  it('no write site sets a target id without propertyId in the same data block', () => {
    const violations: Violation[] = [];
    for (const root of ROOTS) {
      for (const file of walk(root)) {
        const src = readFileSync(file, 'utf8');
        if (!src.includes('unifiedTransaction')) continue;
        let m: RegExpExecArray | null;
        WRITE_CALL.lastIndex = 0;
        while ((m = WRITE_CALL.exec(src))) {
          // The write call's argument window — enough to cover its data block.
          const windowSrc = src.slice(m.index, m.index + 1800);
          if (!SETS_TARGET_ID.test(windowSrc)) continue;
          const stampsInline = /\bpropertyId\s*:/.test(windowSrc);
          const usesResolver =
            src.includes("from '@/lib/bookkeeping/propertyLink'") ||
            src.includes('resolveLinkPropertyId') ||
            src.includes('propertyIdOf');
          if (!stampsInline && !usesResolver) {
            violations.push({
              file,
              index: m.index,
              excerpt: windowSrc.slice(0, 200).replace(/\s+/g, ' '),
            });
          }
        }
      }
    }
    expect(
      violations,
      'Link writes missing a propertyId stamp (use lib/bookkeeping/propertyLink — the ONE rule):\n' +
        violations.map((v) => `  ${v.file} @${v.index}: ${v.excerpt}`).join('\n')
    ).toEqual([]);
  });

  it('dynamic data-object writers reference the ONE resolver', () => {
    // The PATCH field editor builds `updateData` dynamically; the static
    // window scan above cannot see it, so pin it explicitly.
    const patchRoute = readFileSync('app/api/unified-transactions/[id]/route.ts', 'utf8');
    expect(patchRoute).toContain("from '@/lib/bookkeeping/propertyLink'");
    expect(patchRoute).toContain('resolveLinkPropertyId');
  });
});
