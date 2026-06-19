import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '@/lib/env';
import * as schema from './schema';

export type Db = PostgresJsDatabase<typeof schema>;

let _db: Db | null = null;

export function getDb(): Db {
  if (_db) return _db;
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to connect to the database');
  }
  const client = postgres(env.DATABASE_URL);
  _db = drizzle(client, { schema });
  return _db;
}
