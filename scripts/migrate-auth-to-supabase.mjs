import pg from 'pg';

const { Client } = pg;

const sourceUrl = process.env.NEON_DATABASE_URL;
const targetUrl = process.env.SUPABASE_DATABASE_URL;

if (!sourceUrl || !targetUrl) {
  console.error('Set NEON_DATABASE_URL and SUPABASE_DATABASE_URL before running this migration.');
  process.exit(1);
}

if (sourceUrl === targetUrl) {
  console.error('Source and target DATABASE_URL values must be different.');
  process.exit(1);
}

const source = new Client({ connectionString: sourceUrl, application_name: 'tng-auth-export' });
const target = new Client({ connectionString: targetUrl, application_name: 'tng-auth-import' });

const tables = [
  { schema: 'neon_auth', table: 'user', conflict: 'id' },
  { schema: 'neon_auth', table: 'account', conflict: 'id' },
  { schema: 'neon_auth', table: 'session', conflict: 'id' },
  { schema: 'neon_auth', table: 'verification', conflict: 'id' },
  { schema: 'neon_auth', table: 'jwks', conflict: 'id' },
];

const quote = (value) => '"' + String(value).replaceAll('"', '""') + '"';

async function copyTable({ schema, table, conflict }) {
  const sourceResult = await source.query(
    `select * from ${quote(schema)}.${quote(table)}`,
  );
  const rows = sourceResult.rows;
  if (!rows.length) return 0;

  const columns = sourceResult.fields.map((field) => field.name);
  const columnSql = columns.map(quote).join(', ');
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
  const updates = columns
    .filter((column) => column !== conflict)
    .map((column) => `${quote(column)} = EXCLUDED.${quote(column)}`)
    .join(', ');

  const insertSql = `
    insert into ${quote(schema)}.${quote(table)} (${columnSql})
    values (${placeholders})
    on conflict (${quote(conflict)}) do update set ${updates}
  `;

  for (const row of rows) {
    await target.query(insertSql, columns.map((column) => row[column]));
  }
  return rows.length;
}

async function main() {
  await source.connect();
  await target.connect();

  // Confirm the source and destination are reachable before writing anything.
  await source.query('select 1');
  await target.query('select 1');

  await target.query('begin');
  try {
    const copied = {};
    for (const table of tables) {
      copied[table.table] = await copyTable(table);
    }
    await target.query('commit');

    const verification = {};
    for (const table of tables) {
      const result = await target.query(
        `select count(*)::int as count from ${quote(table.schema)}.${quote(table.table)}`,
      );
      verification[table.table] = result.rows[0].count;
    }

    console.log(JSON.stringify({
      status: 'success',
      copied,
      destinationCounts: verification,
      note: 'Only row counts are printed. Credential hashes, OAuth tokens, session tokens, and signing keys are never logged.',
    }, null, 2));
  } catch (error) {
    await target.query('rollback').catch(() => {});
    throw error;
  }
}

main()
  .catch((error) => {
    console.error('Auth data migration failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await source.end().catch(() => {});
    await target.end().catch(() => {});
  });
