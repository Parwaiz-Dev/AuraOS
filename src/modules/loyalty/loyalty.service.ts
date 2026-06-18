/**
 * Loyalty service — earn/redeem points with an immutable ledger.
 *
 * Balance and ledger are mutated together inside the caller's tenant transaction
 * (pass the scoped query fn from withTenant) so they never drift.
 */

import type { TenantQuery } from '@/config/database';

/** Award points for an order. Returns points earned (0 if loyalty disabled). */
export async function earnPoints(
  q: TenantQuery,
  restaurantId: string,
  customerId: string,
  orderId: string,
  orderTotal: number,
  pointsPerCurrency: number,
): Promise<number> {
  const points = Math.floor(orderTotal * pointsPerCurrency);
  if (points <= 0) return 0;

  await q(
    `INSERT INTO loyalty_accounts (restaurant_id, customer_id, points_balance)
     VALUES ($1, $2, $3)
     ON CONFLICT (restaurant_id, customer_id)
     DO UPDATE SET points_balance = loyalty_accounts.points_balance + $3, updated_at = NOW()`,
    [restaurantId, customerId, points],
  );
  await q(
    `INSERT INTO loyalty_ledger (restaurant_id, customer_id, order_id, points, reason)
     VALUES ($1, $2, $3, $4, 'EARN')`,
    [restaurantId, customerId, orderId, points],
  );
  return points;
}

/**
 * Redeem points toward an order. Caps redemption at the available balance and at
 * the points needed to cover `maxRedeemableValue` rupees. Returns the rupee
 * discount applied and points spent.
 */
export async function redeemPoints(
  q: TenantQuery,
  restaurantId: string,
  customerId: string,
  orderId: string | null,
  requestedPoints: number,
  redeemValue: number,
  maxRedeemableValue: number,
): Promise<{ pointsSpent: number; discount: number }> {
  if (requestedPoints <= 0) return { pointsSpent: 0, discount: 0 };

  const acct = await q(
    `SELECT points_balance FROM loyalty_accounts WHERE restaurant_id = $1 AND customer_id = $2 LIMIT 1`,
    [restaurantId, customerId],
  );
  const balance = acct.rows[0]?.points_balance ?? 0;
  if (balance <= 0) return { pointsSpent: 0, discount: 0 };

  const maxPointsByValue = Math.floor(maxRedeemableValue / redeemValue);
  const pointsSpent = Math.min(requestedPoints, balance, maxPointsByValue);
  if (pointsSpent <= 0) return { pointsSpent: 0, discount: 0 };

  const discount = Math.round(pointsSpent * redeemValue * 100) / 100;

  await q(
    `UPDATE loyalty_accounts SET points_balance = points_balance - $3, updated_at = NOW()
     WHERE restaurant_id = $1 AND customer_id = $2`,
    [restaurantId, customerId, pointsSpent],
  );
  await q(
    `INSERT INTO loyalty_ledger (restaurant_id, customer_id, order_id, points, reason)
     VALUES ($1, $2, $3, $4, 'REDEEM')`,
    [restaurantId, customerId, orderId, -pointsSpent],
  );
  return { pointsSpent, discount };
}
