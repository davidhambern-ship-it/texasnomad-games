import { attachDatabasePool } from '@vercel/functions';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import * as schema from './schema.js';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for TNG API requests.');
}

const globalForDatabase = globalThis;

export const pool = globalForDatabase.__tngPool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 20_000,
  connectionTimeoutMillis: 10_000,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : undefined,
});

if (!globalForDatabase.__tngPool) {
  attachDatabasePool(pool);
  globalForDatabase.__tngPool = pool;
}

export const db = drizzle(pool, { schema });
