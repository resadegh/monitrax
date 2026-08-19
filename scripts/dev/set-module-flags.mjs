#!/usr/bin/env node
/**
 * set-module-flags — flip PROD-Simplification module flags on a DEV database.
 * (PROD_SIMPLIFICATION_PLAN.md §7.3 — the post-refresh step: a full PROD→dev
 * copy imports PROD's GlobalFeatureFlag rows, all OFF; dev's standing state is
 * all 13 ON so Preview shows the full app.)
 *
 * Usage (DATABASE_URL must point at the DEV instance):
 *   node scripts/dev/set-module-flags.mjs --all on
 *   node scripts/dev/set-module-flags.mjs MODULE_TAX off
 *   node scripts/dev/set-module-flags.mjs MODULE_TAX on MODULE_CFO on
 *   node scripts/dev/set-module-flags.mjs --all on --dry-run
 *
 * Guarantees:
 *   - Keys come from `lib/featureFlags/moduleRegistry.ts` (parsed, never a
 *     hardcoded second list — §12.2.1). The parse is cross-checked two ways
 *     and the script refuses if they disagree.
 *   - REFUSES to run against PROD (D-9: PROD flags are the admin Modules
 *     panel's job ONLY). Any DATABASE_URL / Cloud SQL identifier that looks
 *     like the prod instance aborts before any connection is made.
 *   - `--dry-run` prints the plan (and current values when a DB is
 *     reachable) and writes nothing. With no DATABASE_URL, `--dry-run`
 *     still prints the parsed-key plan.
 *   - Missing rows are reported, never created — row creation is the seed's
 *     job (`prisma/seed-feature-flags.ts`, runs in every vercel-build).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const REGISTRY_PATH = resolve(__dir, '../../lib/featureFlags/moduleRegistry.ts');

// ── keys from the registry (SSOT), parsed + cross-checked ──────────────────
function loadModuleKeys() {
  const src = readFileSync(REGISTRY_PATH, 'utf8');
  const unionKeys = [...src.matchAll(/^\s*\|\s*'(MODULE_[A-Z_]+)'/gm)].map((m) => m[1]);
  const entryKeys = [...src.matchAll(/key:\s*'(MODULE_[A-Z_]+)'/g)].map((m) => m[1]);
  const a = [...new Set(unionKeys)].sort();
  const b = [...new Set(entryKeys)].sort();
  if (!a.length || a.join() !== b.join()) {
    console.error('✗ moduleRegistry.ts parse mismatch — ModuleKey union vs MODULE_REGISTRY entries:');
    console.error(`   union:   ${a.join(', ') || '(none)'}`);
    console.error(`   entries: ${b.join(', ') || '(none)'}`);
    console.error('  Refusing to act on an uncertain key list. Fix the parse or the registry.');
    process.exit(1);
  }
  return a;
}

// ── PROD refusal (D-9) ──────────────────────────────────────────────────────
function assertNotProd() {
  const suspects = [
    ['DATABASE_URL', process.env.DATABASE_URL],
    ['CLOUD_SQL_CONNECTION_NAME', process.env.CLOUD_SQL_CONNECTION_NAME],
    ['CLOUD_SQL_DB_NAME', process.env.CLOUD_SQL_DB_NAME],
  ];
  for (const [name, value] of suspects) {
    if (value && /prod/i.test(value)) {
      console.error(`✗ REFUSED: ${name} looks like the PRODUCTION instance (${value.replace(/:[^:@/]+@/, ':***@')}).`);
      console.error('  PROD module flags are flipped ONLY via the admin Modules panel (plan D-9 / §4.4).');
      process.exit(1);
    }
  }
}

// ── args ────────────────────────────────────────────────────────────────────
function parseArgs(argv, validKeys) {
  const args = argv.filter((a) => a !== '--dry-run');
  const dryRun = argv.includes('--dry-run');
  const plan = new Map();
  if (args[0] === '--all') {
    const state = args[1];
    if (state !== 'on' && state !== 'off') usageExit(`--all needs "on" or "off", got "${state ?? ''}"`);
    for (const k of validKeys) plan.set(k, state === 'on');
  } else {
    if (!args.length || args.length % 2 !== 0) usageExit('expected --all on|off, or KEY on|off pairs');
    for (let i = 0; i < args.length; i += 2) {
      const [key, state] = [args[i], args[i + 1]];
      if (!validKeys.includes(key)) usageExit(`unknown module key "${key}" (registry has: ${validKeys.join(', ')})`);
      if (state !== 'on' && state !== 'off') usageExit(`"${key}" needs "on" or "off", got "${state}"`);
      plan.set(key, state === 'on');
    }
  }
  return { plan, dryRun };
}

function usageExit(msg) {
  console.error(`✗ ${msg}`);
  console.error('  usage: node scripts/dev/set-module-flags.mjs (--all on|off | KEY on|off ...) [--dry-run]');
  process.exit(1);
}

// ── main ────────────────────────────────────────────────────────────────────
const keys = loadModuleKeys();
const { plan, dryRun } = parseArgs(process.argv.slice(2), keys);
assertNotProd();

console.log(`Module flags (${plan.size} key(s) from moduleRegistry.ts)${dryRun ? ' — DRY RUN, writing nothing' : ''}:`);

if (!process.env.DATABASE_URL) {
  if (dryRun) {
    for (const [k, on] of plan) console.log(`  would set ${k} → ${on ? 'ON' : 'OFF'}`);
    console.log('  (no DATABASE_URL — plan only; current values not read)');
    process.exit(0);
  }
  console.error('✗ DATABASE_URL is not set. Point it at the DEV instance and re-run.');
  process.exit(1);
}

const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();
try {
  let changed = 0;
  const missing = [];
  for (const [key, enabled] of plan) {
    const row = await prisma.globalFeatureFlag.findUnique({ where: { key }, select: { enabled: true } });
    if (!row) {
      missing.push(key);
      console.log(`  ⚠ ${key}: NO ROW (run the seed — prisma/seed-feature-flags.ts)`);
      continue;
    }
    const label = `${key}: ${row.enabled ? 'ON' : 'OFF'} → ${enabled ? 'ON' : 'OFF'}`;
    if (row.enabled === enabled) {
      console.log(`  = ${label} (already)`);
      continue;
    }
    if (dryRun) {
      console.log(`  would ${label}`);
      continue;
    }
    await prisma.globalFeatureFlag.update({ where: { key }, data: { enabled } });
    changed += 1;
    console.log(`  ✓ ${label}`);
  }
  console.log(`${dryRun ? 'Dry run complete' : `Done — ${changed} row(s) changed`}${missing.length ? ` · ${missing.length} missing row(s)` : ''}.`);
  console.log('Verify on a Preview URL: GET /api/feature-flags/modules (allow the 30s gate cache).');
  process.exit(missing.length ? 2 : 0);
} finally {
  await prisma.$disconnect().catch(() => {});
}
