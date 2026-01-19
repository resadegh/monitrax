/**
 * ADMIN SEED SCRIPT
 * Creates the first admin user for the Admin Portal
 *
 * Run with: npx ts-node prisma/seed-admin.ts
 */

import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

// Hash password using SHA-256 (simple for seeding - production should use bcrypt)
function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

async function seedAdmin() {
  console.log('Seeding Admin User...');

  const adminEmail = 'admin@monitrax.com.au';
  const adminPassword = 'Admin123!'; // Default password - CHANGE IN PRODUCTION

  const admin = await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: 'Super Admin',
      passwordHash: hashPassword(adminPassword),
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
