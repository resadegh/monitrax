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

const FLAGS: FlagSeed[] = [
  {
    key: 'BASIQ_INTEGRATION',
    name: 'Basiq Integration',
    description:
      'Master switch for Basiq Open Banking surfaces. When OFF (default), all "Connect bank account" buttons, the Basiq onboarding tile, the consumer balances Basiq panel, and the bank-connections settings section are HIDDEN from end-user UI. The /api/basiq/* routes ALSO refuse with 503 BASIQ_DISABLED (defense in depth). Flip ON only after Basiq accreditation is complete and live keys are configured.',
  },
  {
    key: 'CONVERSATIONAL_ONBOARDING',
    name: 'Conversational Onboarding (Phase 12 Track E)',
    description:
      'Master switch for the conversational + voice input mode on /onboarding. When OFF (default), the form-based wizard (Track B) is the only path — byte-for-byte the existing experience. When ON, a "Chat with Monitrax" toggle appears next to "Fill in a form" on /onboarding, routing users to a parallel chat surface that stages the same OnboardingState and converges on the same ReviewStep + /api/onboarding/bulk-create. See docs/blueprint/PHASE_12_CONVERSATIONAL_ONBOARDING.md.',
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
    .catch((err) => {
      console.error('❌ Seed failed:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
