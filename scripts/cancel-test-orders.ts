import * as dotenv from 'dotenv';
dotenv.config();
import { pool } from '../src/config/database';

async function run() {
  const result = await pool.query(
    `UPDATE orders
     SET status = 'CANCELLED', completed_at = NOW(), updated_at = NOW()
     WHERE status NOT IN ('COMPLETED', 'CANCELLED')
       AND created_at < NOW() - INTERVAL '2 hours'`
  );
  console.log(`✅ Cancelled ${result.rowCount} test orders`);
  await pool.end();
}

run().catch(e => { console.error(e.message); process.exit(1); });
