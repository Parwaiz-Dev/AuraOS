import { Pool, PoolClient } from 'pg';
// env validates DATABASE_URL at startup — no need for manual check here
import { env } from '@/config/env';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

export async function testDatabaseConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

export async function query(text: string, params?: any[]) {
  return pool.query(text, params);
}

/**
 * A query function scoped to a single tenant. Same signature as `query`,
 * but every call runs on a connection where RLS is active for one restaurant.
 */
export type TenantQuery = (text: string, params?: any[]) => Promise<import('pg').QueryResult>;

/**
 * Run `fn` inside a transaction bound to one tenant.
 *
 * The connection sets `app.restaurant_id` for the duration of the transaction,
 * which the RLS policies in migration 021 read via current_setting(). This is the
 * ONLY safe way to issue tenant-scoped queries against RLS-protected tables:
 * a forgotten WHERE clause can no longer leak another tenant's rows.
 *
 * SET LOCAL is transaction-scoped, so the setting is automatically cleared when
 * the transaction ends — even if the pooled connection is reused afterwards.
 *
 * restaurantId MUST be a trusted, server-derived UUID (from the resolved tenant
 * or the authenticated JWT) — never raw user input.
 */
export async function withTenant<T>(
  restaurantId: string,
  fn: (q: TenantQuery, client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Switch into the RLS-subject role for this transaction. The default login
    // role owns the tables and would bypass RLS, so the SET ROLE is what makes
    // the policies in migration 021 actually bite. SET LOCAL ROLE is reverted on
    // COMMIT/ROLLBACK, so the pooled connection is clean for the next checkout.
    await client.query('SET LOCAL ROLE app_tenant');
    // set_config(key, value, is_local=true) — parameterized, so no SQL injection
    // via the id, and scoped to this transaction only.
    await client.query("SELECT set_config('app.restaurant_id', $1, true)", [restaurantId]);

    const scopedQuery: TenantQuery = (text, params) => client.query(text, params);
    const result = await fn(scopedQuery, client);

    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
