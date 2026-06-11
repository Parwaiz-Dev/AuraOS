/**
 * Database Backup Script
 * ───────────────────────
 * Creates a timestamped compressed dump of the PostgreSQL database using
 * `pg_dump`, stores it under ./backups, and prunes old backups beyond the
 * retention window so the folder doesn't grow forever.
 *
 * WHY: AuraOS is multi-tenant — one bad migration or disk failure would lose
 * every restaurant's data. A regular off-process dump is the cheapest insurance.
 *
 * PREREQUISITE:
 *   `pg_dump` must be installed and on your PATH. It ships with PostgreSQL.
 *   Check with:  pg_dump --version
 *
 * RUN MANUALLY:
 *   npm run backup
 *
 * SCHEDULE (recommended — daily):
 *   Windows  → Task Scheduler, action: `npm run backup` in the project dir
 *   Linux    → crontab:  0 2 * * *  cd /path/to/AuraOS && npm run backup
 *   (See scripts/BACKUPS.md for step-by-step scheduling instructions.)
 *
 * RESTORE:
 *   npm run restore -- backups/<filename>.dump
 *   (See scripts/restore-db.ts)
 *
 * CONFIG (optional env vars):
 *   BACKUP_DIR            — where to store dumps      (default: ./backups)
 *   BACKUP_RETENTION_DAYS — delete dumps older than N (default: 14)
 */

import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { env } from '@/config/env';
import { resolvePgTool } from './pgTools';

const BACKUP_DIR = process.env.BACKUP_DIR
  ? path.resolve(process.env.BACKUP_DIR)
  : path.resolve(process.cwd(), 'backups');

const RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS || '14', 10);

/** Build a filesystem-safe timestamp like 2026-05-31_14-30-05 */
function timestamp(): string {
  return new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '').replace('T', '_');
}

/**
 * Delete backup files older than RETENTION_DAYS.
 * Only touches files matching our naming pattern so we never delete
 * unrelated files a user may have placed in the folder.
 */
function pruneOldBackups(): void {
  if (!fs.existsSync(BACKUP_DIR)) return;
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;

  const files = fs.readdirSync(BACKUP_DIR).filter(
    (f) => f.startsWith('auraos-') && (f.endsWith('.dump') || f.endsWith('.sql')),
  );

  let pruned = 0;
  for (const file of files) {
    const full = path.join(BACKUP_DIR, file);
    try {
      const stat = fs.statSync(full);
      if (stat.mtimeMs < cutoff) {
        fs.unlinkSync(full);
        pruned++;
        console.log(`  🗑️  Pruned old backup: ${file}`);
      }
    } catch (err) {
      console.warn(`  ⚠️  Could not inspect ${file}:`, (err as Error).message);
    }
  }
  if (pruned > 0) console.log(`  Pruned ${pruned} backup(s) older than ${RETENTION_DAYS} days`);
}

/**
 * Run pg_dump to create a compressed custom-format dump.
 * Custom format (-Fc) is compressed and restorable with pg_restore,
 * supporting selective/parallel restore — better than a plain .sql file.
 */
function runBackup(): void {
  // Ensure the backup directory exists
  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const fileName = `auraos-${timestamp()}.dump`;
  const filePath = path.join(BACKUP_DIR, fileName);

  console.log('\n📦 AuraOS Database Backup');
  console.log('─'.repeat(40));
  console.log(`  Target: ${filePath}`);

  // Locate pg_dump (PATH → PG_BIN → known install dirs)
  const pgDump = resolvePgTool('pg_dump');
  if (!pgDump) {
    console.error('\n❌ `pg_dump` not found.');
    console.error('   Install PostgreSQL client tools, or set PG_BIN to the bin folder.');
    console.error('   Windows default: C:\\Program Files\\PostgreSQL\\<version>\\bin');
    console.error('   Example: $env:PG_BIN="C:\\Program Files\\PostgreSQL\\16\\bin"; npm run backup\n');
    process.exit(1);
  }

  // pg_dump accepts the full connection string via -d.
  // -Fc = custom compressed format, --no-owner/--no-privileges keep it portable
  // across environments (restore into any role).
  const args = [
    '-d', env.DATABASE_URL,
    '-Fc',
    '--no-owner',
    '--no-privileges',
    '-f', filePath,
  ];

  const result = spawnSync(pgDump, args, {
    stdio: ['ignore', 'inherit', 'inherit'],
  });

  if (result.error) {
    console.error('\n❌ Backup failed:', result.error.message, '\n');
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`\n❌ pg_dump exited with code ${result.status}\n`);
    // Clean up a partial/empty file so we don't keep a corrupt backup
    if (fs.existsSync(filePath) && fs.statSync(filePath).size === 0) {
      fs.unlinkSync(filePath);
    }
    process.exit(1);
  }

  const sizeMb = (fs.statSync(filePath).size / (1024 * 1024)).toFixed(2);
  console.log(`  ✅ Backup complete (${sizeMb} MB)`);

  // Prune old backups after a successful new one
  pruneOldBackups();
  console.log('─'.repeat(40));
  console.log('Done.\n');
}

runBackup();
