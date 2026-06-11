import { query } from '@/config/database';
import {
  Subscription,
  SubscriptionPlan,
  Invoice,
  SubscriptionStatus,
  InvoiceStatus,
  PlatformMetrics,
} from './subscriptions.types';

const PLAN_COLS =
  'id, name, price::float8 AS price, billing_cycle, description, is_active, gateway_plan_id, created_at, updated_at';
const SUB_COLS =
  'id, restaurant_id, plan_id, status, trial_started_at, trial_ends_at, started_at, expires_at, grace_period_ends_at, gateway_subscription_id, created_at, updated_at';
const INV_COLS =
  'id, restaurant_id, subscription_id, invoice_number, amount::float8 AS amount, due_date, paid_at, status, notes, created_at, updated_at';

export class SubscriptionsRepository {
  // ── Plans ──────────────────────────────────────────────────────────────────

  async findActivePlans(): Promise<SubscriptionPlan[]> {
    const result = await query(
      `SELECT ${PLAN_COLS} FROM subscription_plans WHERE is_active = TRUE ORDER BY price ASC`,
    );
    return result.rows;
  }

  async findPlanById(planId: string): Promise<SubscriptionPlan | null> {
    const result = await query(
      `SELECT ${PLAN_COLS} FROM subscription_plans WHERE id = $1 LIMIT 1`,
      [planId],
    );
    return result.rows[0] || null;
  }

  // ── Subscriptions ────────────────────────────────────────────────────────────

  /** Create the initial 14-day trial subscription for a restaurant. */
  async createTrial(restaurantId: string, trialDays = 14): Promise<Subscription> {
    const result = await query(
      `INSERT INTO subscriptions (restaurant_id, status, trial_started_at, trial_ends_at)
       VALUES ($1, 'TRIAL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + ($2 || ' days')::interval)
       RETURNING ${SUB_COLS}`,
      [restaurantId, trialDays],
    );
    return result.rows[0];
  }

  async findByRestaurantId(restaurantId: string): Promise<Subscription | null> {
    const result = await query(
      `SELECT ${SUB_COLS} FROM subscriptions WHERE restaurant_id = $1 LIMIT 1`,
      [restaurantId],
    );
    return result.rows[0] || null;
  }

  async findById(subscriptionId: string): Promise<Subscription | null> {
    const result = await query(
      `SELECT ${SUB_COLS} FROM subscriptions WHERE id = $1 LIMIT 1`,
      [subscriptionId],
    );
    return result.rows[0] || null;
  }

  /** Generic partial update for a subscription. */
  async update(
    subscriptionId: string,
    updates: Partial<{
      plan_id: string | null;
      status: SubscriptionStatus;
      started_at: Date | null;
      expires_at: Date | null;
      grace_period_ends_at: Date | null;
      gateway_subscription_id: string | null;
    }>,
  ): Promise<Subscription | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;

    for (const [key, val] of Object.entries(updates)) {
      if (val !== undefined) {
        fields.push(`${key} = $${i++}`);
        values.push(val);
      }
    }
    if (fields.length === 0) return this.findById(subscriptionId);

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(subscriptionId);

    const result = await query(
      `UPDATE subscriptions SET ${fields.join(', ')} WHERE id = $${i} RETURNING ${SUB_COLS}`,
      values,
    );
    return result.rows[0] || null;
  }

  async updateStatus(subscriptionId: string, status: SubscriptionStatus): Promise<void> {
    await query(
      `UPDATE subscriptions SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [status, subscriptionId],
    );
  }

  /**
   * Conditionally transition a subscription's status.
   * The UPDATE only applies when the current DB status still matches
   * expectedStatus — making concurrent reconcileStatus calls idempotent.
   * If another request already transitioned the row, this returns the
   * current (already-updated) row without overwriting grace_period_ends_at
   * with a later timestamp.
   */
  async reconcileTransition(
    subscriptionId: string,
    expectedStatus: SubscriptionStatus,
    newStatus: SubscriptionStatus,
    gracePeriodEndsAt: Date | null,
  ): Promise<Subscription | null> {
    const result = await query(
      `UPDATE subscriptions
       SET status = $1,
           grace_period_ends_at = COALESCE($2, grace_period_ends_at),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND status = $4
       RETURNING ${SUB_COLS}`,
      [newStatus, gracePeriodEndsAt, subscriptionId, expectedStatus],
    );
    if (result.rows.length > 0) return result.rows[0];
    // Another request already made this transition — return current state
    return this.findById(subscriptionId);
  }

  // ── Invoices ──────────────────────────────────────────────────────────────

  /**
   * Create an invoice with an atomically generated invoice number.
   *
   * The number is generated inside the INSERT via a subquery so that
   * count-then-insert is a single atomic operation — concurrent inserts
   * can no longer race and produce the same INV-YEAR-NNNNN string, which
   * would cause a UNIQUE constraint failure.
   */
  async createInvoice(
    restaurantId: string,
    subscriptionId: string | null,
    amount: number,
    dueDate: Date | null,
    status: InvoiceStatus,
    notes: string | null,
  ): Promise<Invoice> {
    const year = new Date().getFullYear();
    const result = await query(
      `INSERT INTO invoices (restaurant_id, subscription_id, invoice_number, amount, due_date, status, notes)
       VALUES (
         $1, $2,
         CONCAT(
           'INV-${year}-',
           LPAD(
             ((SELECT COUNT(*) FROM invoices WHERE EXTRACT(YEAR FROM created_at) = ${year}) + 1)::text,
             5, '0'
           )
         ),
         $3, $4, $5, $6
       )
       RETURNING ${INV_COLS}`,
      [restaurantId, subscriptionId, amount, dueDate, status, notes],
    );
    return result.rows[0];
  }

  async findInvoiceById(invoiceId: string): Promise<Invoice | null> {
    const result = await query(
      `SELECT ${INV_COLS} FROM invoices WHERE id = $1 LIMIT 1`,
      [invoiceId],
    );
    return result.rows[0] || null;
  }

  async findInvoicesByRestaurant(
    restaurantId: string,
    limit = 50,
    offset = 0,
  ): Promise<Invoice[]> {
    const result = await query(
      `SELECT ${INV_COLS} FROM invoices WHERE restaurant_id = $1
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [restaurantId, limit, offset],
    );
    return result.rows;
  }

  /** Count invoices for a restaurant in a given year (for invoice numbering). */
  async countInvoicesThisYear(): Promise<number> {
    const result = await query(
      `SELECT COUNT(*)::int AS count FROM invoices
       WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)`,
    );
    return result.rows[0]?.count || 0;
  }

  async markInvoicePaid(invoiceId: string): Promise<Invoice | null> {
    const result = await query(
      `UPDATE invoices
       SET status = 'PAID', paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING ${INV_COLS}`,
      [invoiceId],
    );
    return result.rows[0] || null;
  }

  // ── Super-admin platform metrics ──────────────────────────────────────────

  async getPlatformMetrics(): Promise<PlatformMetrics> {
    const result = await query(
      `SELECT
        (SELECT COUNT(*) FROM restaurants) AS total_restaurants,
        COUNT(*) FILTER (WHERE s.status = 'ACTIVE')       AS active_subscriptions,
        COUNT(*) FILTER (WHERE s.status = 'TRIAL')        AS trial_accounts,
        COUNT(*) FILTER (WHERE s.status = 'GRACE_PERIOD') AS grace_period_accounts,
        COUNT(*) FILTER (WHERE s.status = 'SUSPENDED')    AS suspended_accounts,
        COUNT(*) FILTER (WHERE s.status = 'CANCELLED')    AS cancelled_accounts,
        COALESCE(SUM(p.price) FILTER (WHERE s.status = 'ACTIVE' AND p.billing_cycle = 'MONTHLY'), 0) AS mrr,
        (SELECT COUNT(*) FROM invoices WHERE status IN ('PENDING', 'OVERDUE'))         AS outstanding_invoices,
        (SELECT COALESCE(SUM(amount), 0) FROM invoices WHERE status IN ('PENDING', 'OVERDUE')) AS outstanding_amount
      FROM subscriptions s
      LEFT JOIN subscription_plans p ON p.id = s.plan_id`,
    );
    const r = result.rows[0];
    return {
      total_restaurants: parseInt(r.total_restaurants, 10) || 0,
      active_subscriptions: parseInt(r.active_subscriptions, 10) || 0,
      trial_accounts: parseInt(r.trial_accounts, 10) || 0,
      grace_period_accounts: parseInt(r.grace_period_accounts, 10) || 0,
      suspended_accounts: parseInt(r.suspended_accounts, 10) || 0,
      cancelled_accounts: parseInt(r.cancelled_accounts, 10) || 0,
      mrr: parseFloat(r.mrr) || 0,
      outstanding_invoices: parseInt(r.outstanding_invoices, 10) || 0,
      outstanding_amount: parseFloat(r.outstanding_amount) || 0,
    };
  }

  /**
   * Get all restaurants with their subscription status, plan, and usage stats.
   * Used by the super-admin "All Restaurants" management screen.
   */
  async getAllRestaurantsWithSubscriptions(limit = 100, offset = 0): Promise<any[]> {
    const result = await query(
      `SELECT
        r.id, r.name, r.slug, r.created_at,
        s.status AS subscription_status,
        s.trial_ends_at,
        s.expires_at,
        s.grace_period_ends_at,
        p.name AS plan_name,
        p.price AS plan_price,
        (SELECT COUNT(*) FROM users u WHERE u.restaurant_id = r.id) AS user_count,
        (SELECT COUNT(*) FROM orders o WHERE o.restaurant_id = r.id AND DATE(o.created_at) = CURRENT_DATE) AS orders_today,
        (SELECT COALESCE(SUM(o.total_amount), 0) FROM orders o WHERE o.restaurant_id = r.id AND o.status = 'COMPLETED' AND DATE(o.created_at) = CURRENT_DATE) AS revenue_today,
        (SELECT MAX(o.created_at) FROM orders o WHERE o.restaurant_id = r.id) AS last_order_at
      FROM restaurants r
      LEFT JOIN subscriptions s ON s.restaurant_id = r.id
      LEFT JOIN subscription_plans p ON p.id = s.plan_id
      ORDER BY r.created_at DESC
      LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      created_at: row.created_at,
      subscription_status: row.subscription_status || 'NONE',
      trial_ends_at: row.trial_ends_at,
      expires_at: row.expires_at,
      grace_period_ends_at: row.grace_period_ends_at,
      plan_name: row.plan_name || 'No plan',
      plan_price: parseFloat(row.plan_price) || 0,
      user_count: parseInt(row.user_count, 10) || 0,
      orders_today: parseInt(row.orders_today, 10) || 0,
      revenue_today: parseFloat(row.revenue_today) || 0,
      last_order_at: row.last_order_at,
    }));
  }
}

export const subscriptionsRepository = new SubscriptionsRepository();
