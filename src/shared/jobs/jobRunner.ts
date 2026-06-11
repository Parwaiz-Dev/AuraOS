/**
 * Job Runner — manages all background jobs.
 *
 * Jobs are simple interval-based functions. Each job:
 *   - Runs on a fixed interval
 *   - Catches its own errors (never crashes the server)
 *   - Logs what it does
 *
 * Jobs registered here:
 *   - delayDetector  — every 30s — alerts kitchen about delayed orders
 *   - inventorySync  — every 60s — alerts staff about low stock
 *
 * Usage (in server.ts):
 *   import { startJobs, stopJobs } from '@/shared/jobs/jobRunner';
 *   startJobs();                    // call after server starts
 *   process.on('SIGTERM', stopJobs) // call on shutdown
 *
 * Adding a new job:
 *   1. Create src/shared/jobs/myJob.ts with an exported async function
 *   2. Import it here and add an entry to the JOBS array below
 */

import { runDelayDetector } from './delayDetector';
import { runInventorySync } from './inventorySync';

interface Job {
  name: string;
  intervalMs: number;
  run: () => Promise<void>;
}

const JOBS: Job[] = [
  {
    name: 'DelayDetector',
    intervalMs: 30 * 1000,   // every 30 seconds
    run: runDelayDetector,
  },
  {
    name: 'InventorySync',
    intervalMs: 60 * 1000,   // every 60 seconds
    run: runInventorySync,
  },
];

// Store interval handles so we can clear them on shutdown
const handles: ReturnType<typeof setInterval>[] = [];

/**
 * Start all background jobs.
 * Call this once after the HTTP server starts listening.
 *
 * Each job runs immediately on start, then on its interval.
 */
export function startJobs(): void {
  console.log(`\n⚙️  Starting ${JOBS.length} background job(s)...`);

  for (const job of JOBS) {
    // Run immediately on startup so we don't wait for the first interval
    job.run().catch((err) => {
      console.error(`[${job.name}] Initial run failed:`, err);
    });

    // Then run on interval
    const handle = setInterval(() => {
      job.run().catch((err) => {
        console.error(`[${job.name}] Run failed:`, err);
      });
    }, job.intervalMs);

    handles.push(handle);
    console.log(`  ✅ ${job.name} — every ${job.intervalMs / 1000}s`);
  }

  console.log('');
}

/**
 * Stop all background jobs gracefully.
 * Call this on SIGTERM / SIGINT before process.exit().
 */
export function stopJobs(): void {
  console.log('⚙️  Stopping background jobs...');
  for (const handle of handles) {
    clearInterval(handle);
  }
  handles.length = 0;
  console.log('✅ Background jobs stopped');
}
