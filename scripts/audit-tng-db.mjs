#!/usr/bin/env node
/**
 * Read-only migration inventory of the existing TNG Neon PostgreSQL database.
 *
 * No row data, emails, tokens, credentials or password hashes are exported.
 * Run only after Neon database access is restored. This is not a backup.
 *
 * Usage:
 *   DATABASE_URL=... node scripts/audit-tng-db.mjs > tng-schema-inventory.json
 *   DATABASE_URL=... node scripts/audit-tng-db.mjs --exact-counts > tng-schema-inventory.json
 *
 * Store generated output privately (never commit a live database dump).
 */
import pg from 'pg';

const countRows = process.argv.includes('--exact-counts');
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  process.stderr.write('DATABASE_URL must be configured to run the read-only audit.\n');
  process.exitCode = 1;
} else {
  const client = new pg.Client({
    connectionString,
    application_name: 'tng-passport-read-only-inventory',
    connectionTimeoutMillis: 10000,
  });

  // Quote catalog-sourced identifiers for optional, explicit exact counts.
  const quoteIdent = (name) => '"' + String(name).replaceAll('"', '""') + '"';
  const isUserSchema = (name) =>
    !['pg_catalog', 'information_schema'].includes(name)
    && !name.startsWith('pg_');

  try {
    await client.connect();
    await client.query('BEGIN READ ONLY');
    await client.query("SET LOCAL statement_timeout = '20000ms'");

    const tables = (await client.query(`
      SELECT n.nspname AS schema_name,
             c.relname AS table_name,
             c.reltuples::bigint AS estimated_rows,
             pg_total_relation_size(c.oid)::bigint AS size_bytes,
             c.relrowsecurity AS row_level_security,
             c.relforcerowsecurity AS force_row_level_security
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind IN ('r', 'p')
      ORDER BY n.nspname, c.relname
    `)).rows.filter((r) => isUserSchema(r.schema_name));

    const columns = (await client.query(`
      SELECT table_schema AS schema_name, table_name, column_name,
             data_type, udt_name, is_nullable, ordinal_position
      FROM information_schema.columns
      ORDER BY table_schema, table_name, ordinal_position
    `)).rows.filter((r) => isUserSchema(r.schema_name));

    const constraints = (await client.query(`
      SELECT n.nspname AS schema_name, c.relname AS table_name,
             con.conname AS constraint_name, con.contype AS constraint_type,
             pg_get_constraintdef(con.oid, true) AS definition
      FROM pg_catalog.pg_constraint con
      JOIN pg_catalog.pg_class c ON c.oid = con.conrelid
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      ORDER BY n.nspname, c.relname, con.conname
    `)).rows.filter((r) => isUserSchema(r.schema_name));

    if (countRows) {
      // Metadata-only mode is the default. Exact counts can be much slower.
      for (const table of tables) {
        const target = quoteIdent(table.schema_name) + '.' + quoteIdent(table.table_name);
        const result = await client.query('SELECT count(*)::bigint AS n FROM ' + target);
        table.exact_rows = result.rows[0].n;
      }
    }

    await client.query('COMMIT');
    process.stdout.write(JSON.stringify({
      inventory_version: 1,
      generated_at: new Date().toISOString(),
      counts_exact: countRows,
      warning: 'Schema metadata only. NOT a database backup. No row contents included.',
      tables, columns, constraints,
    }, null, 2) + '\n');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    // Do not echo connection URLs or potentially sensitive server errors.
    process.stderr.write('Read-only inventory could not complete. Confirm Neon quota and database access.\n');
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}
