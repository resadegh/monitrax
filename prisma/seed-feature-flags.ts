/**
 * Feature flag seed — ensures canonical platform-wide flags exist in
 * `GlobalFeatureFlag`. Idempotent (`upsert` by `key`).
 *
 * Run via `npm run seed:feature-flags` or once-off after the next prod
 * deploy. Adding a row here does NOT enable the flag — the `enabled`
 * default is `false`, the admin operator flips via
 * `/admin/feature-flags`.
 *
 * Why a seed instead of a migration: feature flag rows are runtime
 * configuration, not schema. Migrations are for shape; seeds are for
 * data. The `GlobalFeatureFlag` table is part of Phase 33 admin
 * infrastructure — this file just makes sure the platform-canonical
 * flag rows are present.
 */

import { prisma } from '../lib/db';

interface FlagSeed {
  key: string;
  name: string;
  description: string;
}

// Phase 12 Track G.2 (2026-05-21): the CONVERSATIONAL_ONBOARDING flag was
// retired — the standalone chat path it gated is replaced by the unified
// in-wizard companion (Track G.1). No code reads the flag any more; the
// seed no longer creates it. Any existing DB row is harmless and inert.
// See docs/blueprint/PHASE_12_TRACK_G_UNIFIED_ONBOARDING.md.
const FLAGS: FlagSeed[] = [
  {
    key: 'BASIQ_INTEGRATION',
    name: 'Basiq Integration',
    description:
      'Master switch for Basiq Open Banking surfaces. When OFF (default), all "Connect bank account" buttons, the Basiq onboarding tile, the consumer balances Basiq panel, and the bank-connections settings section are HIDDEN from end-user UI. The /api/basiq/* routes ALSO refuse with 503 BASIQ_DISABLED (defense in depth). Flip ON only after Basiq accreditation is complete and live keys are configured.',
  },
];

export async function runFeatureFlagSeed(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('FEATURE FLAG SEED');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  for (const flag of FLAGS) {
    const result = await prisma.globalFeatureFlag.upsert({
      where: { key: flag.key },
      // Update path: refresh the human-readable `name` and `description`
      // so future name/description tweaks land via re-seed. DO NOT
      // overwrite `enabled` — that's the operator's call, not the
      // seed's. The same logic applies to `enabledForPercent` /
      // `enabledForTiers` / `enabledForPlans` if they're ever used.
      update: {
        name: flag.name,
        description: flag.description,
      },
      create: {
        key: flag.key,
        name: flag.name,
        description: flag.description,
        enabled: false, // ← OFF by default. Operator flips via admin.
      },
      select: { key: true, enabled: true },
    });
    console.log(`  ✓ ${result.key} — enabled=${result.enabled}`);
  }

  console.log('');
  console.log('✅ Seed complete.');
  console.log('');
  console.log('To toggle a flag: /admin/feature-flags');
}

if (require.main === module) {
  runFeatureFlagSeed()
    .then(async () => {
      await prisma.$disconnect();
      // Force exit so the `&&` chain in `vercel-build` proceeds.
      // Prisma + Cloud SQL keep background timers alive after
      // $disconnect() that would otherwise keep the Node event
      // loop running indefinitely — blocking the next build step.
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('❌ Seed failed:', err);
      await prisma.$disconnect().catch(() => {});
      process.exit(1);
    });
}
