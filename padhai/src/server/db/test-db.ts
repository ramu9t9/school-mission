import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from './schema';
import type { Db } from './client';

/**
 * Spin up an in-memory Postgres (PGlite) with all migrations applied.
 * Used only by tests so `npm test` needs no external database.
 */
export async function createTestDb(): Promise<{ db: Db; close: () => Promise<void> }> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: './drizzle' });
  return {
    db: db as unknown as Db,
    close: () => client.close(),
  };
}
