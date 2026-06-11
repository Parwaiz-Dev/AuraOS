/**
 * Database Restore Script
 * ───────────────────────
 * Restores a backup created by scripts/backup-db.ts using `pg_restore`.
 *
 * ⚠️  DESTRUCTIVE: this OVERWRITES the current database contents.
 *     It uses --clean --if-exists to drop existing objects before recreating
 *     them from the dump. Make sure you target the right database.
 *
 * PREREQUISITE:
 *   `pg_restore` must be installed and on your PATH (ships with PostgreSQL).
 *
 * USAGE:
 *   npm run restore -- backups/auraos-2026-05-31_02-00-00.dump
 *
 * SAFETY:
 *   - Requires you to pass --yes (or set RESTORE_CONFIRM=yes) to actually run,
 *     otherwise it only prints what it WOULD do. This prevents accidental wipes.
 */

import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { env } from '@/config/env';
import { resolvePgTool } from './pgTools';

function fail(msg: string): never {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

function main(): void {
  // argv: [node, script, <file>, ...flags]
  const args = process.argv.slice(2);
  const fileArg = args.find((a) => !a.startsWith('--'));
  const confirmed = args.includes('--yes') || process.env.RESTORE_CONFIRM === 'yes';

  if (!fileArg) {
    fail('No backup file specified.\n   Usage: npm run restore -- backups/<file>.dump [--yes]');
  }

  const filePath = path.resolve(fileArg!);
  if (!fs.existsSync(filePath)) {
    fail(`Backup file not found: ${filePath}`);
  }

  console.log('\n♻️  AuraOS Database Restore');
  console.log('─'.repeat(40));
  console.log(`  Source:   ${filePath}`);
  console.log(`  Target DB: ${maskUrl(env.DATABASE_URL)}`);

  if (!confirmed) {
    console.log('\n  ⚠️  DRY RUN — no changes made.');
    console.log('  This will OVERWRITE the target database (drop + recreate objects).');
    console.log('  Re-run with --yes to proceed:');
    console.log(`     npm run restore -- ${fileArg} --yes\n`);
    return;
  }

  // -d connection string, --clean drops objects first, --if-exists avoids errors
  // on first restore, --no-owner ignores ownership from the dump.
  const restoreArgs = [
    '-d', env.DATABASE_URL,
    '--clean',
    '--if-exists',
    '--no-owner',
    '--no-privileges',
    filePath,
  ];

  // Locate pg_restore (PATH → PG_BIN → known install dirs)
  const pgRestore = resolvePgTool('pg_restore');
  if (!pgRestore) {
    fail('`pg_restore` not found. Install PostgreSQL client tools or set PG_BIN to the bin folder.');
  }

  console.log('\n  Restoring… (this may take a moment)');
  const result = spawnSync(pgRestore!, restoreArgs, {
    stdio: ['ignore', 'inherit', 'inherit'],
  });

  if (result.error) {
    fail(`Restore failed: ${result.error.message}`);
  }

  // pg_restore can exit non-zero on harmless warnings (e.g. "does not exist"
  // during --clean on a fresh DB). Surface the code but don't treat as fatal
  // unless it's a hard error.
  if (result.status !== 0) {
    console.warn(`\n  ⚠️  pg_restore exited with code ${result.status}.`);
    console.warn('     This is often just warnings from --clean on a fresh DB.');
    console.warn('     Verify your data looks correct.\n');
  } else {
    console.log('  ✅ Restore complete.\n');
  }
}

/** Hide the password portion of a connection string when logging. */
function maskUrl(url: string): string {
  return url.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:****@');
}

main();
