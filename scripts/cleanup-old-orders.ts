/**
 * Cleanup script — cancels all open orders older than 24 hours.
 * These are test/dev orders that were never completed.
 *
 * Run: npx ts-node -r tsconfig-paths/register scripts/cleanup-old-orders.ts
 */

import * as dotenv from 'dotenv';
dotenv.config();
import { pool } from '../src/config/database';

async function cleanup() {
  const client = await pool.connect();
  try {
    console.log('\n🔍 Finding old open orders...\n');

    const preview = await client.query(
      `SELECT order_number, status, created_at,
              EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 AS hours_old
       FROM orders
       WHERE status NOT IN ('COMPLETED', 'CANCELLED')
         AND created_at < NOW() - INTERVAL '24 hours'
       ORDER BY created_at ASC`,
    );

    if (preview.rows.length === 0) {
      console.log('✅ No old open orders found.\n');
      return;
    }

    console.log(`Found ${preview.rows.length} old open order(s):\n`);
    preview.rows.forEach((r) => {
      console.log(`  ${r.order_number.padEnd(45)} ${r.status.padEnd(12)} ${Math.floor(r.hours_old)}h old`);
    });

    console.log('\nCancelling all...');

    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE orders
       SET status = 'CANCELLED', completed_at = NOW(), updated_at = NOW()
       WHERE status NOT IN ('COMPLETED', 'CANCELLED')
         AND created_at < NOW() - INTERVAL '24 hours'`,
    );

    await client.query('COMMIT');
    console.log(`\n✅ Cancelled ${result.rowCount} old order(s).\n`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Cleanup failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

cleanup();
