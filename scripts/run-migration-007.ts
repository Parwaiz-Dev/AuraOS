import * as dotenv from 'dotenv';
dotenv.config();
import { pool } from '../src/config/database';

async function run() {
  try {
    await pool.query(`
      ALTER TABLE restaurants
        ADD COLUMN IF NOT EXISTS qr_mode VARCHAR(20) NOT NULL DEFAULT 'restaurant'
    `);
    // Add check constraint separately (safe to run multiple times)
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'restaurants_qr_mode_check'
        ) THEN
          ALTER TABLE restaurants
            ADD CONSTRAINT restaurants_qr_mode_check
            CHECK (qr_mode IN ('restaurant', 'mall'));
        END IF;
      END$$;
    `);
    console.log('✅ Migration 007: qr_mode column added');
  } catch (err: any) {
    console.error('❌', err.message);
  } finally {
    await pool.end();
  }
}

run();
