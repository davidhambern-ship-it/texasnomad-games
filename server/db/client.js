import * as schema from './schema.js';

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

const globalForDatabase = globalThis;
let pool;
let db;

if (typeof Deno !== 'undefined') {
  const connectionString = Deno.env.get('SUPABASE_DB_URL') || Deno.env.get('DATABASE_URL') || '';
  if (!connectionString) throw new Error('SUPABASE_DB_URL is required for TNG Edge API requests.');

  const [{ default: postgres }, { drizzle }] = await Promise.all([
    import('postgres'),
    import('drizzle-orm/postgres-js'),
  ]);

  const sql = postgres(connectionString, {
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
    ssl: 'require',
  });

  const wrapResult = (rows) => ({ rows, rowCount: rows.count ?? rows.length });

  pool = globalForDatabase.__tngPool ?? {
    query: async (query, values = []) => wrapResult(await sql.unsafe(query, values)),
    connect: async () => {
      const client = await sql.reserve();
      return {
        query: async (query, values = []) => wrapResult(await client.unsafe(query, values)),
        release: () => client.release(),
      };
    },
  };

  globalForDatabase.__tngPool = pool;
  db = drizzle(sql, { schema });
} else {
  const [{ drizzle }, pg] = await Promise.all([
    import('drizzle-orm/node-postgres'),
    import('pg'),
  ]);
  const { Pool } = pg.default || pg;

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for TNG API requests.');
  }

  pool = globalForDatabase.__tngPool ?? new Pool({
    connectionString: normalizePgConnectionString(process.env.DATABASE_URL),
    max: 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 10_000,
  });

  if (!globalForDatabase.__tngPool) {
    pool.on('error', (error) => {
      console.warn('[TNG database pool] idle client disconnected:', error.message);
    });
    globalForDatabase.__tngPool = pool;
  }

  db = drizzle(pool, { schema });
}

export { pool, db };
