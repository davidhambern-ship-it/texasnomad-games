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
  // Long-lived runtimes (including Neon Functions) may reclaim idle Postgres
  // connections. pg removes dead clients from the pool; this listener prevents
  // an expected idle disconnect from becoming an uncaught process error.
  pool.on('error', (error) => {
    console.warn('[TNG database pool] idle client disconnected:', error.message);
  });
  globalForDatabase.__tngPool = pool;
}

export const db = drizzle(pool, { schema });
