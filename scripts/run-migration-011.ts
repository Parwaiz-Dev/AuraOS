import * as dotenv from 'dotenv';
dotenv.config();
import * as fs from 'fs';
import * as path from 'path';
import { pool } from '../src/config/database';

async function run() {
  const sql = fs.readFileSync(path.join(__dirname, '../migrations/011_subscriptions.sql'), 'utf8');
  try {
    await pool.query(sql);
    console.log('✅ Migration 011: subscription_plans, subscriptions, invoices created + seeded');
  } catch (err: any) {
    if (err.message.includes('already exists')) {
      console.log('ℹ️  Migration 011: already applied');
    } else {
      console.error('❌', err.message);
      process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

run();
