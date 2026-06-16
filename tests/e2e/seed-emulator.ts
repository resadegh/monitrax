/**
 * Phase 4 · Layer 4 — seed synthetic users into the Firebase Auth EMULATOR
 * and link each to the archetype user that `seed:lighthouse` created in the
 * monitrax_e2e Postgres DB.
 *
 * Flow per archetype user:
 *   1. accounts:signUp on the emulator (idempotent: fall back to sign-in) → UID
 *   2. mark emailVerified (emulator admin, best-effort) so the app's
 *      verification guards don't block the dashboard
 *   3. upsert OAuthAccount{provider:'gcp-identity', providerUserId: UID} onto
 *      the seeded Postgres user (matched by email) — this is what
 *      findOrSyncUser (lib/auth/context.ts) resolves on the first /api/auth/me
 *
 * Synthetic data only; runs ONLY against the emulator + the job's monitrax_e2e
 * DB (never dev/prod). Requires FIREBASE_AUTH_EMULATOR_HOST to be set.
 */
import { PrismaClient } from '@prisma/client';
import { E2E_USERS } from './users';

const prisma = new PrismaClient();
const HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const PROJECT = process.env.GCP_PROJECT_ID || 'monitrax-e2e';
const KEY = 'fake-e2e-api-key'; // emulator ignores the key value
const BASE = `http://${HOST}/identitytoolkit.googleapis.com/v1`;

async function post(url: string, body: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, status: res.status, json: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

async function ensureEmulatorUser(email: string, password: string): Promise<string> {
  // 1. Try signUp; on EMAIL_EXISTS, sign in to recover the UID (idempotent).
  let r = await post(`${BASE}/accounts:signUp?key=${KEY}`, { email, password, returnSecureToken: true });
  if (!r.ok) {
    r = await post(`${BASE}/accounts:signInWithPassword?key=${KEY}`, { email, password, returnSecureToken: true });
  }
  const uid = r.json.localId as string | undefined;
  if (!uid) throw new Error(`Emulator user create/sign-in failed for ${email}: ${JSON.stringify(r.json)}`);

  // 2. Mark verified via the emulator's privileged update (Bearer owner). Best
  //    effort — if it errors, the user is still usable for most flows.
  await post(
    `${BASE}/projects/${PROJECT}/accounts:update`,
    { localId: uid, emailVerified: true },
    { Authorization: 'Bearer owner' },
  ).catch(() => undefined);

  return uid;
}

async function main() {
  if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error('FIREBASE_AUTH_EMULATOR_HOST not set — refusing to run (emulator-only seed).');
  }
  for (const u of Object.values(E2E_USERS)) {
    const uid = await ensureEmulatorUser(u.email, u.password);

    const user = await prisma.user.findUnique({ where: { email: u.email }, select: { id: true } });
    if (!user) {
      console.warn(`⚠️  No seeded Postgres user for ${u.email} — run seed:lighthouse first. Skipping link.`);
      continue;
    }

    // Link the emulator UID to the seeded user so findOrSyncUser resolves it.
    const existing = await prisma.oAuthAccount.findFirst({
      where: { provider: 'gcp-identity', providerUserId: uid },
      select: { id: true },
    });
    if (existing) {
      await prisma.oAuthAccount.update({ where: { id: existing.id }, data: { userId: user.id, email: u.email } });
    } else {
      await prisma.oAuthAccount.create({
        data: { userId: user.id, provider: 'gcp-identity', providerUserId: uid, email: u.email },
      });
    }
    console.log(`✅ ${u.label}: emulator uid ${uid} → user ${user.id}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
