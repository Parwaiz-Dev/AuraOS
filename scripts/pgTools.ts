/**
 * pgTools — locate PostgreSQL client binaries (pg_dump / pg_restore).
 *
 * Resolution order:
 *   1. PG_BIN env var (explicit override) — e.g. PG_BIN=C:\PostgreSQL\16\bin
 *   2. The tool on PATH (just the bare name, e.g. "pg_dump")
 *   3. Common install locations (Windows / macOS / Linux)
 *
 * This means backups work out-of-the-box even when the PostgreSQL bin folder
 * isn't on PATH (a very common Windows situation), while still allowing an
 * explicit override for non-standard installs.
 */

import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const IS_WIN = process.platform === 'win32';
const EXE = IS_WIN ? '.exe' : '';

/** Return true if running `<cmd> --version` succeeds. */
function works(cmd: string): boolean {
  const res = spawnSync(cmd, ['--version'], { stdio: 'ignore' });
  return !res.error && res.status === 0;
}

/** Gather candidate bin directories from known install locations. */
function candidateDirs(): string[] {
  const dirs: string[] = [];

  if (process.env.PG_BIN) dirs.push(process.env.PG_BIN);

  if (IS_WIN) {
    // Scan C:\Program Files\PostgreSQL\<version>\bin (newest first)
    for (const base of [
      'C:\\Program Files\\PostgreSQL',
      'C:\\Program Files (x86)\\PostgreSQL',
    ]) {
      try {
        if (fs.existsSync(base)) {
          const versions = fs
            .readdirSync(base)
            .map((v) => ({ v, n: parseInt(v, 10) }))
            .filter((x) => !isNaN(x.n))
            .sort((a, b) => b.n - a.n); // newest version first
          for (const { v } of versions) {
            dirs.push(path.join(base, v, 'bin'));
          }
        }
      } catch {
        /* ignore unreadable dirs */
      }
    }
  } else {
    // macOS (Homebrew) + common Linux locations
    dirs.push(
      '/opt/homebrew/opt/libpq/bin',
      '/usr/local/opt/libpq/bin',
      '/usr/local/bin',
      '/usr/bin',
      '/usr/lib/postgresql/16/bin',
      '/usr/lib/postgresql/15/bin',
      '/usr/lib/postgresql/14/bin',
    );
  }

  return dirs;
}

/**
 * Resolve the full path (or bare command) for a PostgreSQL tool.
 * Returns null if it cannot be found anywhere.
 */
export function resolvePgTool(tool: 'pg_dump' | 'pg_restore'): string | null {
  // 1. Bare command on PATH
  if (works(tool)) return tool;

  // 2. Known directories
  for (const dir of candidateDirs()) {
    const full = path.join(dir, tool + EXE);
    if (fs.existsSync(full) && works(full)) return full;
  }

  return null;
}
