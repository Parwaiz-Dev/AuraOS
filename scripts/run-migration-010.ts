import * as dotenv from 'dotenv';
dotenv.config();
import * as fs from 'fs';
import * as path from 'path';
import { pool } from '../src/config/database';

async function run() {
  const sql = fs.readFileSync(path.join(__dirname, '../migrations/010_zomato_mapping.sql'), 'utf8');
  try {
    await pool.query(sql);
    console.log('✅ Migration 010: zomato_item_mappings table created');
  } catch (err: any) {
    if (err.message.includes('already exists')) {
      console.log('ℹ️  Migration 010: already applied');
    } else {
      console.error('❌', err.message);
      process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

run();
