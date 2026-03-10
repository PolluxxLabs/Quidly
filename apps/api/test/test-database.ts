import 'dotenv/config';
import { execFileSync } from 'child_process';
import { randomUUID } from 'crypto';
import { resolve } from 'path';
import { Pool } from 'pg';

export type TestDatabaseContext = {
  schema: string;
  databaseUrl: string;
  teardown: () => Promise<void>;
};

function getBaseDatabaseUrl() {
  const databaseUrl =
    process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5432/quidly?schema=public';

  return new URL(databaseUrl);
}

export async function setupTestDatabase(): Promise<TestDatabaseContext> {
  const schema = `test_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const schemaUrl = getBaseDatabaseUrl();
  const adminUrl = getBaseDatabaseUrl();

  schemaUrl.searchParams.set('schema', schema);
  adminUrl.searchParams.delete('schema');

  const pool = new Pool({
    connectionString: adminUrl.toString(),
  });

  await pool.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
  await pool.end();

  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: resolve(__dirname, '..'),
    env: {
      ...process.env,
      DATABASE_URL: schemaUrl.toString(),
    },
    stdio: 'pipe',
  });

  process.env.DATABASE_URL = schemaUrl.toString();

  return {
    schema,
    databaseUrl: schemaUrl.toString(),
    teardown: async () => {
      const cleanupPool = new Pool({
        connectionString: adminUrl.toString(),
      });

      await cleanupPool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await cleanupPool.end();
    },
  };
}
