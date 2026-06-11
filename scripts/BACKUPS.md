# Database Backups & Restore

AuraOS is multi-tenant — a single data loss event affects every restaurant on
the platform. This document explains how to back up and restore the PostgreSQL
database.

## What you get

- `npm run backup` — creates a timestamped compressed dump in `./backups`
- `npm run restore -- <file>` — restores a dump (overwrites current DB)
- Automatic pruning of dumps older than the retention window (default 14 days)

Backups use PostgreSQL's **custom format** (`pg_dump -Fc`), which is compressed
and supports selective/parallel restore via `pg_restore`.

## Prerequisite — pg_dump / pg_restore

These tools ship with PostgreSQL. Confirm they're on your PATH:

```bash
pg_dump --version
pg_restore --version
```

If "command not found":
- **Windows**: add the PostgreSQL `bin` folder to PATH, e.g.
  `C:\Program Files\PostgreSQL\15\bin`
- **macOS** (Homebrew): `brew install libpq && brew link --force libpq`
- **Linux**: `sudo apt-get install postgresql-client`

> Tip: the client tools version should be >= your server version.

## Create a backup

```bash
npm run backup
```

Output goes to `./backups/auraos-<timestamp>.dump`.

### Optional configuration (env vars)

| Variable | Default | Purpose |
|---|---|---|
| `BACKUP_DIR` | `./backups` | Where dumps are written |
| `BACKUP_RETENTION_DAYS` | `14` | Dumps older than this are deleted after each run |

Example (keep 30 days, store on another drive):

```bash
# Windows (PowerShell)
$env:BACKUP_DIR="D:\auraos-backups"; $env:BACKUP_RETENTION_DAYS="30"; npm run backup
```

## Restore a backup

> ⚠️ **Destructive** — this drops and recreates objects in the target database.

```bash
# Dry run first (shows what it WOULD do, makes no changes)
npm run restore -- backups/auraos-2026-05-31_02-00-00.dump

# Actually restore
npm run restore -- backups/auraos-2026-05-31_02-00-00.dump --yes
```

## Schedule daily backups

Backups are only useful if they run automatically. Schedule `npm run backup`
to run daily (early morning is ideal — low traffic).

### Windows — Task Scheduler

1. Open **Task Scheduler** → **Create Basic Task**.
2. Name: `AuraOS DB Backup`. Trigger: **Daily**, e.g. 2:00 AM.
3. Action: **Start a program**.
   - Program/script: `cmd.exe`
   - Add arguments:
     `/c cd /d C:\Projects\AuraOS && npm run backup >> backups\backup.log 2>&1`
4. Finish. Right-click the task → **Run** to test it once.

### Linux / macOS — cron

```bash
crontab -e
# Add (runs daily at 2 AM):
0 2 * * * cd /path/to/AuraOS && /usr/bin/npm run backup >> backups/backup.log 2>&1
```

## Off-site copies (important)

Local backups don't protect against disk failure or theft of the machine.
After the dump runs, copy `./backups` to a separate location:

- Cloud object storage (AWS S3, Backblaze B2, Google Cloud Storage)
- A different physical disk or NAS
- A managed Postgres provider's own automated backups (if you migrate there)

A simple approach: have your scheduled task also run an upload command (e.g.
`aws s3 sync ./backups s3://my-bucket/auraos-backups`) after `npm run backup`.

## Restore drills

Test your restore process on a throwaway database at least once. A backup you've
never restored is a backup you can't trust.

```bash
# Point DATABASE_URL at a scratch DB, then:
npm run restore -- backups/<latest>.dump --yes
```
