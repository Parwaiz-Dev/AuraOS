import * as dotenv from 'dotenv';
dotenv.config();
import * as fs from 'fs';
import * as path from 'path';
import { pool } from '../src/config/database';

async function run() {
  const sql = fs.readFileSync(path.join(__dirname, '../migrations/013_missing_indexes.sql'), 'utf8');
  try {
    await pool.query(sql);
    console.log('✅ Migration 013: missing indexes added (payments.reference_number, integration_logs dedup, payments.order_status)');
  } catch (err: any) {
    if (err.message.includes('already exists')) {
      console.log('ℹ️  Migration 013: already applied');
    } else {
      console.error('❌', err.message);
      process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

run();
