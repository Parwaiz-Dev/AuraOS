import { pool, withTenant } from '@/config/database';

/**
 * RLS tenant-isolation guarantee.
 *
 * This is the production-grade contract for the multi-tenant public surface:
 * a query scoped to tenant A through withTenant() must NEVER see tenant B's rows,
 * and must never be able to write rows belonging to another tenant.
 *
 * If this test fails, tenant data is leaking — treat it as a release blocker.
 *
 * Requires a running Postgres with migrations applied (incl. 021_rls.sql).
 */
describe('RLS tenant isolation', () => {
  let restaurantA: string;
  let restaurantB: string;

  beforeAll(async () => {
    const a = await pool.query(
      `INSERT INTO restaurants (name, slug) VALUES ($1, $2) RETURNING id`,
      ['RLS Test A', `rls-test-a-${Date.now()}`],
    );
    const b = await pool.query(
      `INSERT INTO restaurants (name, slug) VALUES ($1, $2) RETURNING id`,
      ['RLS Test B', `rls-test-b-${Date.now()}`],
    );
    restaurantA = a.rows[0].id;
    restaurantB = b.rows[0].id;

    // One menu category per restaurant, created with full privileges (bypasses RLS).
    await pool.query(
      `INSERT INTO menu_categories (restaurant_id, name) VALUES ($1, $2)`,
      [restaurantA, 'Cat A'],
    );
    await pool.query(
      `INSERT INTO menu_categories (restaurant_id, name) VALUES ($1, $2)`,
      [restaurantB, 'Cat B'],
    );
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM restaurants WHERE id = ANY($1::uuid[])`, [
      [restaurantA, restaurantB],
    ]);
    await pool.end();
  });

  it('reads only the active tenant rows', async () => {
    const rows = await withTenant(restaurantA, async (q) => {
      const r = await q(`SELECT restaurant_id, name FROM menu_categories`);
      return r.rows;
    });

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.restaurant_id === restaurantA)).toBe(true);
    expect(rows.some((r) => r.restaurant_id === restaurantB)).toBe(false);
  });

  it('returns zero rows when explicitly querying another tenant', async () => {
    const rows = await withTenant(restaurantA, async (q) => {
      const r = await q(`SELECT id FROM menu_categories WHERE restaurant_id = $1`, [
        restaurantB,
      ]);
      return r.rows;
    });

    expect(rows).toHaveLength(0);
  });

  it('cannot insert a row for a different tenant (WITH CHECK)', async () => {
    await expect(
      withTenant(restaurantA, async (q) => {
        await q(`INSERT INTO menu_categories (restaurant_id, name) VALUES ($1, $2)`, [
          restaurantB,
          'Smuggled',
        ]);
      }),
    ).rejects.toThrow();

    // Confirm nothing landed in B.
    const check = await pool.query(
      `SELECT 1 FROM menu_categories WHERE restaurant_id = $1 AND name = 'Smuggled'`,
      [restaurantB],
    );
    expect(check.rows).toHaveLength(0);
  });
});
