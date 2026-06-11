/**
 * Cleanup script — removes test/junk data from the database.
 * Keeps only the seed tables (T1–T5) and any tables with real names.
 *
 * Run: npx ts-node -r tsconfig-paths/register scripts/cleanup-test-data.ts
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { pool } from '../src/config/database';

async function cleanup() {
  const client = await pool.connect();

  try {
    console.log('\n🔍 Scanning for test/junk data...\n');

    // ── 1. Show all tables ──────────────────────────────────────────────────
    const allTables = await client.query(
      `SELECT id, table_number, seats, is_active, created_at
       FROM restaurant_tables
       ORDER BY created_at ASC`
    );

    console.log(`Found ${allTables.rows.length} tables total:`);
    allTables.rows.forEach((t) => {
      console.log(`  ${t.is_active ? '✅' : '❌'} ${t.table_number.padEnd(30)} ${t.seats} seats  (${new Date(t.created_at).toLocaleString()})`);
    });

    // ── 2. Identify junk tables ─────────────────────────────────────────────
    // Junk = table_number starts with "TEST-" (timestamp-based names from testing)
    const junkTables = allTables.rows.filter((t) =>
      /^TEST-\d{10,}/.test(t.table_number)
    );

    if (junkTables.length === 0) {
      console.log('\n✅ No test tables found. Database is clean.\n');
    } else {
      console.log(`\n🗑️  Found ${junkTables.length} test table(s) to delete:`);
      junkTables.forEach((t) => console.log(`   - ${t.table_number}`));

      await client.query('BEGIN');

      // Delete orders linked to these tables first (FK constraint)
      const junkIds = junkTables.map((t) => t.id);
      const placeholders = junkIds.map((_, i) => `$${i + 1}`).join(', ');

      const linkedOrders = await client.query(
        `SELECT id FROM orders WHERE table_id IN (${placeholders})`,
        junkIds
      );

      if (linkedOrders.rows.length > 0) {
        const orderIds = linkedOrders.rows.map((o) => o.id);
        const orderPlaceholders = orderIds.map((_, i) => `$${i + 1}`).join(', ');
        await client.query(`DELETE FROM order_items WHERE order_id IN (${orderPlaceholders})`, orderIds);
        await client.query(`DELETE FROM orders WHERE id IN (${orderPlaceholders})`, orderIds);
        console.log(`   Removed ${linkedOrders.rows.length} linked order(s)`);
      }

      await client.query(
        `DELETE FROM restaurant_tables WHERE id IN (${placeholders})`,
        junkIds
      );

      await client.query('COMMIT');
      console.log(`\n✅ Deleted ${junkTables.length} test table(s) successfully.\n`);
    }

    // ── 3. Show remaining tables ────────────────────────────────────────────
    const remaining = await client.query(
      `SELECT table_number, seats, is_active FROM restaurant_tables ORDER BY table_number ASC`
    );
    console.log(`\n📋 Remaining tables (${remaining.rows.length}):`);
    remaining.rows.forEach((t) => {
      console.log(`   ${t.is_active ? '✅' : '❌'} ${t.table_number} — ${t.seats} seats`);
    });

    console.log('\n✨ Done.\n');
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
