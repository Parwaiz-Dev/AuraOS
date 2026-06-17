import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set in environment variables');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
});

const MIGRATIONS_DIR = join(__dirname, '../migrations');

interface Migration {
  name: string;
  sql: string;
}

async function getMigrations(): Promise<Migration[]> {
  const fs = await import('fs').then(m => m.promises);
  const files = await fs.readdir(MIGRATIONS_DIR);

  const sqlFiles = files
    .filter(f => f.endsWith('.sql'))
    .sort();

  const migrations: Migration[] = [];

  for (const file of sqlFiles) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8');
    migrations.push({
      name: file,
      sql,
    });
  }

  return migrations;
}

/**
 * Split a SQL file into individual statements on top-level semicolons.
 *
 * Naive split-on-";" breaks any statement containing a dollar-quoted body
 * (DO $$ ... $$, CREATE FUNCTION ... $$ ... $$), because those bodies legally
 * contain semicolons. This splitter tracks dollar-quote tags ($$, $tag$),
 * single-quoted strings, and line/block comments so procedural migrations
 * (needed for RLS role setup) run as single statements.
 */
function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let i = 0;
  let dollarTag: string | null = null; // active dollar-quote tag, e.g. "$$" or "$body$"
  let inSingleQuote = false;

  while (i < sql.length) {
    const ch = sql[i];
    const two = sql.slice(i, i + 2);

    if (dollarTag) {
      if (sql.startsWith(dollarTag, i)) {
        current += dollarTag;
        i += dollarTag.length;
        dollarTag = null;
        continue;
      }
      current += ch;
      i++;
      continue;
    }

    if (inSingleQuote) {
      current += ch;
      i++;
      if (ch === "'") inSingleQuote = false;
      continue;
    }

    // Line comment — copy through end of line
    if (two === '--') {
      const nl = sql.indexOf('\n', i);
      const end = nl === -1 ? sql.length : nl;
      current += sql.slice(i, end);
      i = end;
      continue;
    }

    // Block comment — copy through closing */
    if (two === '/*') {
      const close = sql.indexOf('*/', i + 2);
      const end = close === -1 ? sql.length : close + 2;
      current += sql.slice(i, end);
      i = end;
      continue;
    }

    // Opening dollar-quote tag: $$ or $identifier$
    if (ch === '$') {
      const match = /^\$[A-Za-z0-9_]*\$/.exec(sql.slice(i));
      if (match) {
        dollarTag = match[0];
        current += dollarTag;
        i += dollarTag.length;
        continue;
      }
    }

    if (ch === "'") {
      inSingleQuote = true;
      current += ch;
      i++;
      continue;
    }

    if (ch === ';') {
      const trimmed = current.trim();
      if (trimmed.length > 0) statements.push(trimmed);
      current = '';
      i++;
      continue;
    }

    current += ch;
    i++;
  }

  const tail = current.trim();
  if (tail.length > 0) statements.push(tail);
  return statements;
}

async function createMigrationsLog(client: any): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS migrations_log (
      id SERIAL PRIMARY KEY,
      migration_name VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function hasBeenRun(client: any, migrationName: string): Promise<boolean> {
  const result = await client.query(
    'SELECT 1 FROM migrations_log WHERE migration_name = $1',
    [migrationName]
  );
  return result.rows.length > 0;
}

async function logMigration(client: any, migrationName: string): Promise<void> {
  await client.query(
    'INSERT INTO migrations_log (migration_name) VALUES ($1) ON CONFLICT DO NOTHING',
    [migrationName]
  );
}

async function runMigrations(): Promise<void> {
  const client = await pool.connect();

  try {
    console.log('\n╔═════════════════════════════════════════════╗');
    console.log('║   🗄️  AuraOS Database Migrations Runner    ║');
    console.log('╚═════════════════════════════════════════════╝\n');

    // Create migrations log table
    await createMigrationsLog(client);

    // Get all migrations
    const migrations = await getMigrations();

    if (migrations.length === 0) {
      console.log('⚠️  No migration files found in migrations/ directory');
      return;
    }

    let executedCount = 0;
    let skippedCount = 0;

    for (const migration of migrations) {
      const alreadyRun = await hasBeenRun(client, migration.name);

      if (alreadyRun) {
        console.log(`⏭️  Skipping: ${migration.name} (already executed)`);
        skippedCount++;
      } else {
        try {
          console.log(`📄 Running migration: ${migration.name}`);

          // Split SQL statements (dollar-quote / comment / string aware)
          const statements = splitSqlStatements(migration.sql);

          // Execute each statement
          for (const statement of statements) {
            await client.query(statement);
          }

          // Log that migration has been run
          await logMigration(client, migration.name);

          console.log(`✅ Migration completed: ${migration.name}\n`);
          executedCount++;
        } catch (error: any) {
          console.error(`❌ Error running migration ${migration.name}:`);
          console.error(error.message);
          throw error;
        }
      }
    }

    console.log('╔═════════════════════════════════════════════╗');
    console.log('║   ✅ Migrations Complete!                   ║');
    console.log('├─────────────────────────────────────────────┤');
    console.log(`│  Executed:  ${executedCount} new migrations${' '.repeat(20 - executedCount.toString().length)}│`);
    console.log(`│  Skipped:   ${skippedCount} already run${' '.repeat(23 - skippedCount.toString().length)}│`);
    console.log(`│  Total:     ${migrations.length} migrations${' '.repeat(23 - migrations.length.toString().length)}│`);
    console.log('╚═════════════════════════════════════════════╝\n');

    console.log('📊 Database schema ready!');
    console.log('🧑‍💼 Demo admin login:');
    console.log('   Email: admin@demo-kitchen.local');
    console.log('   Password: demo123\n');
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.release();
    await pool.end();
  }
}

// Run migrations
runMigrations().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
