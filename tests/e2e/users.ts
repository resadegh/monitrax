/**
 * Phase 4 · Layer 4 — synthetic E2E login users.
 *
 * These emails match the consumer archetypes that `prisma/seed-lighthouse.ts`
 * creates in the monitrax_e2e Postgres DB. The Auth-emulator seed
 * (`seed-emulator.ts`) creates a matching Firebase Auth emulator user for each
 * (with the password below) and links its UID to the seeded Postgres user, so
 * a login resolves to that user's archetype data. Passwords are SYNTHETIC and
 * only ever used against the local emulator — never a real credential.
 */
export interface E2eUser {
  key: 'sole' | 'family' | 'multi';
  email: string;
  password: string;
  label: string;
}

export const E2E_PASSWORD = 'E2e-Test-Passw0rd!';

export const E2E_USERS: Record<E2eUser['key'], E2eUser> = {
  // Sarah Kim — sole owner + a Pty Ltd (company).
  sole: { key: 'sole', email: 'sarah.kim@example.com', password: E2E_PASSWORD, label: 'Sarah Kim (sole / company)' },
  // David Mei — couple (joint w/ Emma) + discretionary trust + SMSF + company.
  family: { key: 'family', email: 'david.mei@example.com', password: E2E_PASSWORD, label: 'David Mei (couple + trust + SMSF + company)' },
  // Olivia Novak — multi-entity (company + family trust + unit trust + SMSF).
  multi: { key: 'multi', email: 'olivia.novak@example.com', password: E2E_PASSWORD, label: 'Olivia Novak (multi-entity)' },
};
