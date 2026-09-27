import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { assertConnectedToTestDatabase } from '../utils/test-database';
import { testEnv } from './test-env';

const BACKEND_DIR = join(__dirname, '..', '..');

function prisma(command: string) {
  return execSync(`npx prisma ${command}`, {
    cwd: BACKEND_DIR,
    env: process.env,
    stdio: ['ignore', 'pipe', 'inherit'],
  }).toString();
}

// Arma la base de test desde cero aplicando las migraciones, igual que en
// producción, y falla si schema.prisma tiene cambios sin su migración.
export default async function globalSetup() {
  Object.assign(process.env, testEnv);

  const client = new PrismaClient();
  try {
    await assertConnectedToTestDatabase(client);
    await client.$executeRawUnsafe('DROP SCHEMA IF EXISTS public CASCADE');
    await client.$executeRawUnsafe('CREATE SCHEMA public');
  } finally {
    await client.$disconnect();
  }

  prisma('migrate deploy');

  const drift = prisma(
    `migrate diff --from-url "${testEnv.DATABASE_URL}" --to-schema-datamodel prisma/schema.prisma --script`,
  );
  if (!drift.includes('empty migration')) {
    throw new Error(
      `schema.prisma tiene cambios sin migración. Creala con \`npx prisma migrate dev --create-only\`:\n${drift}`,
    );
  }
}
