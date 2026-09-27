import { PrismaClient } from '@prisma/client';

// Freno de seguridad: lo que borra o sincroniza datos solo corre contra una base *_test.
export function assertTestDatabaseName(name: string) {
  if (!name.endsWith('_test')) {
    throw new Error(
      `Refusing to run against database "${name}": test helpers only touch *_test databases`,
    );
  }
}

export async function assertConnectedToTestDatabase(prisma: PrismaClient) {
  const [{ name }] = await prisma.$queryRaw<
    { name: string }[]
  >`SELECT current_database() AS name`;
  assertTestDatabaseName(name);
}

// Vacía todas las tablas del schema (menos el historial de migraciones), así
// cada test arranca de cero.
export async function resetDb(prisma: PrismaClient) {
  await assertConnectedToTestDatabase(prisma);
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;

  const tableList = tables
    .map(({ tablename }) => `"public"."${tablename}"`)
    .join(', ');
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`,
  );
}
