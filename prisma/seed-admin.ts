/**
 * ADMIN SEED SCRIPT
 * Creates the first admin user for the Admin Portal
 *
 * Run with: npx ts-node prisma/seed-admin.ts
 */

import { PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';

const prisma = new PrismaClient();

// Hash password using salt:hash format (same as lib/admin/auth.ts)
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = createHash('sha256').update(password + salt).digest('hex');
  return `${salt}:${hash}`;
}

async function seedAdmin() {
  console.log('Seeding Admin User...');

  const adminEmail = 'admin@monitrax.com.au';
  const adminPassword = 'Admin123!'; // Default password - CHANGE IN PRODUCTION

  const passwordHash = hashPassword(adminPassword);

  const admin = await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash: passwordHash,
      isActive: true,
    },
    create: {
      email: adminEmail,
      name: 'Super Admin',
      passwordHash: passwordHash,
      role: 'SUPER_ADMIN',
      isActive: true,
      mfaEnabled: false,
    },
  });

  console.log('✅ Admin user created:');
  console.log(`   Email: ${adminEmail}`);
  console.log(`   Password: ${adminPassword}`);
  console.log(`   Role: SUPER_ADMIN`);
  console.log('');
  console.log('⚠️  IMPORTANT: Change this password in production!');

  return admin;
}

async function main() {
  try {
    await seedAdmin();
    console.log('\n✅ Admin seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding admin:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
