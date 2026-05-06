/**
 * PORTAL TEST ACCESS SEED
 *
 * Idempotent script that ensures `admin@monitrax.com.au` (and any other
 * email passed via the `EXTRA_PORTAL_OWNERS` env var, comma-separated)
 * has PORTAL_OWNER access to the Smithfield Wealth Advisers demo Org
 * created by `seed-lighthouse.ts`.
 *
 * Why this script exists:
 *   The Org Portal at `/portal/signin` requires the signed-in user to
 *   have an active `OrganizationMember` row pointing at an org. The
 *   lighthouse seed creates Reza's demo account at
 *   `reza@smithfieldwealth.com.au` — but Reza's day-to-day admin
 *   account is `admin@monitrax.com.au`, which has no portal access by
 *   default. This script bridges that gap without forking the
 *   lighthouse seed (which is scoped to demo data).
 *
 * Run:
 *   npm run seed:portal-access                    # default — admin@monitrax.com.au
 *   EXTRA_PORTAL_OWNERS=foo@bar.com npm run seed:portal-access
 *
 * Prerequisites:
 *   1. The `User` row for the email must already exist (created via
 *      the consumer signup flow). This script does NOT create User
 *      rows — that path goes through Firebase Auth + the
 *      provisioning hook in lib/auth/. If the User doesn't exist,
 *      this script will report "User not found" and exit cleanly.
 *   2. The Smithfield Wealth Advisers Org must exist (run
 *      `npm run seed:lighthouse` first if not).
 *   3. **The `PORTAL_ENABLED=true` environment variable must be set
 *      on Vercel for the Org Portal to be accessible** — see
 *      `lib/portal/featureFlags.ts` line 117. This script grants
 *      database access; the env var is the master toggle.
 */
import { prisma } from '../lib/db';

const SMITHFIELD_ORG_ID = 'lh-org-smithfield';

async function grantPortalAccess(email: string): Promise<'granted' | 'already' | 'no-user'> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, name: true, email: true },
  });

  if (!user) {
    return 'no-user';
  }

  const existing = await prisma.organizationMember.findFirst({
    where: { userId: user.id, organizationId: SMITHFIELD_ORG_ID },
    select: { id: true, isActive: true },
  });

  if (existing) {
    if (!existing.isActive) {
      await prisma.organizationMember.update({
        where: { id: existing.id },
        data: { isActive: true },
      });
      return 'granted';
    }
    return 'already';
  }

  await prisma.organizationMember.create({
    data: {
      organizationId: SMITHFIELD_ORG_ID,
      userId: user.id,
      role: 'OWNER',
      joinedAt: new Date(),
      isActive: true,
    },
  });

  return 'granted';
}

/**
 * Importable entry point — called by `app/api/admin/run-seed/route.ts` so the
 * grant can be applied through Vercel runtime auth (WIF) without a Cloud SQL
 * Proxy. The CLI bootstrap below remains for local use via
 * `npm run seed:portal-access`.
 */
export async function runPortalAccessSeed(extraEmails: string[] = []): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('PORTAL TEST ACCESS SEED');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Ensure Smithfield Org exists (lighthouse seed should have created it)
  const org = await prisma.organization.findUnique({
    where: { id: SMITHFIELD_ORG_ID },
    select: { id: true, name: true },
  });
  if (!org) {
    throw new Error(
      'Smithfield Wealth Advisers Org not found. Run the lighthouse seed first to create it.',
    );
  }
  console.log(`Target org: ${org.name} (${org.id})`);
  console.log('');

  const emails = ['admin@monitrax.com.au'];
  for (const e of extraEmails) {
    const trimmed = e.trim().toLowerCase();
    if (trimmed && !emails.includes(trimmed)) emails.push(trimmed);
  }

  for (const email of emails) {
    const result = await grantPortalAccess(email);
    if (result === 'granted') {
      console.log(`  ✓ ${email} — granted PORTAL_OWNER access`);
    } else if (result === 'already') {
      console.log(`  · ${email} — already has active access (no change)`);
    } else {
      console.log(`  ⚠ ${email} — User row not found.`);
      console.log(`     The User must be created first via Firebase Auth signup`);
      console.log(`     at /signup or by signing in once via /signin to trigger`);
      console.log(`     the auto-provisioning hook in the consumer auth flow.`);
    }
  }

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Seed complete.');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('REMEMBER:');
  console.log('  • The Org Portal requires PORTAL_ENABLED=true env var on Vercel.');
  console.log('  • Without that env var, /api/portal/organizations returns 503');
  console.log('    PORTAL_NOT_ENABLED, and the sign-in page shows');
  console.log('    "Failed to verify organization access. Please try again."');
  console.log('  • Set in Vercel → Settings → Environment Variables → Production:');
  console.log('       PORTAL_ENABLED = true');
  console.log('  • Redeploy after setting the env var.');
}

// CLI bootstrap — only runs when invoked directly via
// `npm run seed:portal-access`, NOT when imported.
if (require.main === module) {
  const extra = process.env.EXTRA_PORTAL_OWNERS
    ? process.env.EXTRA_PORTAL_OWNERS.split(',').map((e) => e.trim()).filter(Boolean)
    : [];

  runPortalAccessSeed(extra)
    .catch((err) => {
      console.error('❌ Seed failed:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
