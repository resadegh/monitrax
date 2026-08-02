/**
 * The reference-numbers scoreboard must never go stale.
 *
 * `docs/architecture/REFERENCE_NUMBERS_SCOREBOARD.md` is generated from the
 * producer census + the Neomatrix + the contracts directory. If any of those
 * move and the scoreboard is not regenerated, it becomes a claim about
 * progress that did not happen — which is the exact failure CLAUDE.md §22.2.4
 * forbids ("coverage is a build output, never a human claim").
 *
 * This test is the enforcement: it runs the generator in --check mode, which
 * exits non-zero when the committed file disagrees with its sources.
 *
 * Fix a failure with: npm run refnums:scoreboard
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '../..');

describe('reference-numbers scoreboard', () => {
  it('is not stale against the census, the Neomatrix and the contracts directory', () => {
    expect(() =>
      execFileSync('node', ['scripts/reference-numbers/scoreboard.mjs', '--check'], {
        cwd: ROOT,
        stdio: 'pipe',
      }),
    ).not.toThrow();
  });
});
