import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

const { Pool } = pg;

export function normalizePgConnectionString(value) {
  const raw = String(value || '').trim();
  if (!raw) return raw;
  try {
    const url = new URL(raw);
    const sslMode = String(url.searchParams.get('sslmode') || '').toLowerCase();
    if (['prefer', 'require', 'verify-ca'].includes(sslMode)) {
      url.searchParams.set('sslmode', 'verify-full');
    }
    return url.toString();
  } catch {
    return raw;
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for TNG API requests.');
}

const globalForDatabase = globalThis;
export const pool = globalForDatabase.__tngPool ?? new Pool({
  connectionString: normalizePgConnectionString(process.env.DATABASE_URL),
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

if (!globalForDatabase.__tngPool) {
  pool.on('error', (error) => {
    console.warn('[TNG database pool] idle client disconnected:', error.message);
  });
  globalForDatabase.__tngPool = pool;
}

export const db = drizzle(pool, { schema });
