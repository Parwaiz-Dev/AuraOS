import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const ALREADY_APPLIED = [
  '008_password_reset.sql',
  '009_inventory_history.sql',
  '010_zomato_mapping.sql',
  '011_subscriptions.sql',
  '012_restaurant_features.sql',
  '014_admin_inquiries_support.sql',
];

(async () => {
  const client = await pool.connect();
  try {
    for (const m of ALREADY_APPLIED) {
      await client.query(
        'INSERT INTO migrations_log (migration_name) VALUES ($1) ON CONFLICT DO NOTHING',
        [m],
      );
      console.log('Marked as applied:', m);
    }
    console.log('\nDone. Now run: npx ts-node -r tsconfig-paths/register scripts/migrate.ts');
  } finally {
    client.release();
    await pool.end();
  }
})();
