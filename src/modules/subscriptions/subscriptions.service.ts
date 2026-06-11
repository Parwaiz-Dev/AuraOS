import { subscriptionsRepository } from './subscriptions.repository';
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionView,
  Invoice,
  InvoiceStatus,
  PlatformMetrics,
  SubscriptionStatus,
} from './subscriptions.types';
import { BadRequestError, NotFoundError } from '@/shared/errors/AppError';
import { authRepository } from '@/modules/auth/auth.repository';

// How long a trial lasts, and how long the grace period runs after expiry.
const TRIAL_DAYS = 14;
const GRACE_DAYS = 7;

export class SubscriptionsService {
  /** Called from onboarding — every new restaurant starts a 14-day trial. */
  async startTrial(restaurantId: string): Promise<Subscription> {
    const existing = await subscriptionsRepository.findByRestaurantId(restaurantId);
    if (existing) return existing;
    return subscriptionsRepository.createTrial(restaurantId, TRIAL_DAYS);
  }

  /**
   * Compute the day-count between now and a future date (ceil, never negative).
   */
  private daysUntil(date: Date | null): number | null {
    if (!date) return null;
    const ms = new Date(date).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  }

  /**
   * Lazily transition a subscription's status based on the clock.
   * This runs on every read so state is always current without a cron job
   * (a scheduled job can also call this, but it's not required for correctness):
   *   TRIAL  + trial_ends_at passed        → GRACE_PERIOD (sets grace_period_ends_at)
   *   ACTIVE + expires_at passed           → GRACE_PERIOD (sets grace_period_ends_at)
   *   GRACE_PERIOD + grace ended           → SUSPENDED
   * Returns the (possibly updated) subscription.
   */
  async reconcileStatus(sub: Subscription): Promise<Subscription> {
    const now = Date.now();

    // TRIAL or ACTIVE whose window has elapsed → enter grace period.
    // Uses reconcileTransition (WHERE id = ? AND status = ?) so concurrent
    // requests are idempotent — only the first writer changes the row and
    // sets grace_period_ends_at; subsequent callers get the already-updated row.
    if (sub.status === 'TRIAL' || sub.status === 'ACTIVE') {
      const windowEnd = sub.status === 'TRIAL' ? sub.trial_ends_at : sub.expires_at;
      if (windowEnd && new Date(windowEnd).getTime() <= now) {
        const graceEnds = new Date(now + GRACE_DAYS * 24 * 60 * 60 * 1000);
        const updated = await subscriptionsRepository.reconcileTransition(
          sub.id,
          sub.status,
          'GRACE_PERIOD',
          graceEnds,
        );
        return updated ?? sub;
      }
    }

    // GRACE_PERIOD whose grace window has elapsed → suspend
    if (sub.status === 'GRACE_PERIOD' && sub.grace_period_ends_at) {
      if (new Date(sub.grace_period_ends_at).getTime() <= now) {
        const updated = await subscriptionsRepository.reconcileTransition(
          sub.id,
          'GRACE_PERIOD',
          'SUSPENDED',
          null,
        );
        return updated ?? sub;
      }
    }

    return sub;
  }

  /**
   * Get the restaurant's subscription, reconciled and enriched with plan +
   * computed countdowns. Auto-creates a trial if somehow missing (safety net).
   */
  async getSubscriptionView(restaurantId: string): Promise<SubscriptionView> {
    let sub = await subscriptionsRepository.findByRestaurantId(restaurantId);
    if (!sub) {
      sub = await subscriptionsRepository.createTrial(restaurantId, TRIAL_DAYS);
    }
    sub = await this.reconcileStatus(sub);

    const plan = sub.plan_id
      ? await subscriptionsRepository.findPlanById(sub.plan_id)
      : null;

    // days_remaining: trial countdown while on trial, else countdown to expiry
    let daysRemaining: number | null = null;
    if (sub.status === 'TRIAL') daysRemaining = this.daysUntil(sub.trial_ends_at);
    else if (sub.status === 'ACTIVE') daysRemaining = this.daysUntil(sub.expires_at);

    const graceDaysRemaining =
      sub.status === 'GRACE_PERIOD' ? this.daysUntil(sub.grace_period_ends_at) : null;

    const nextRenewal =
      sub.expires_at ?? (sub.status === 'TRIAL' ? sub.trial_ends_at : null);

    return {
      ...sub,
      plan,
      days_remaining: daysRemaining,
      grace_days_remaining: graceDaysRemaining,
      next_renewal_date: nextRenewal,
    };
  }

  /**
   * Lightweight status check used by the checkSubscription middleware.
   * Returns the reconciled status only (cheap, no plan join).
   */
  async getEffectiveStatus(restaurantId: string): Promise<SubscriptionStatus | null> {
    let sub = await subscriptionsRepository.findByRestaurantId(restaurantId);
    if (!sub) return null;
    sub = await this.reconcileStatus(sub);
    return sub.status;
  }

  // ── Plans ──────────────────────────────────────────────────────────────────

  async getPlans(): Promise<SubscriptionPlan[]> {
    return subscriptionsRepository.findActivePlans();
  }

  /**
   * Change the restaurant's plan. In Phase 1 (manual billing) this activates the
   * subscription and sets a one-cycle expiry; an invoice is raised separately.
   */
  async changePlan(restaurantId: string, planId: string): Promise<SubscriptionView> {
    const plan = await subscriptionsRepository.findPlanById(planId);
    if (!plan || !plan.is_active) {
      throw new BadRequestError('Plan not found or inactive');
    }

    let sub = await subscriptionsRepository.findByRestaurantId(restaurantId);
    if (!sub) {
      sub = await subscriptionsRepository.createTrial(restaurantId, TRIAL_DAYS);
    }

    // Compute new paid window from the plan's billing cycle.
    const now = new Date();
    let expiresAt: Date | null = null;
    if (plan.billing_cycle === 'MONTHLY') {
      expiresAt = new Date(now);
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    } else if (plan.billing_cycle === 'YEARLY') {
      expiresAt = new Date(now);
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    }
    // CUSTOM (Enterprise) leaves expiry open — handled by manual agreement.

    await subscriptionsRepository.update(sub.id, {
      plan_id: planId,
      status: 'ACTIVE',
      started_at: now,
      expires_at: expiresAt,
      grace_period_ends_at: null,
    });

    return this.getSubscriptionView(restaurantId);
  }

  // ── Invoices ──────────────────────────────────────────────────────────────

  async getInvoices(restaurantId: string, limit = 50, offset = 0): Promise<Invoice[]> {
    return subscriptionsRepository.findInvoicesByRestaurant(restaurantId, limit, offset);
  }

  async createInvoice(
    restaurantId: string,
    amount: number,
    dueDate: string | undefined,
    notes: string | undefined,
    subscriptionId: string | undefined,
    status: InvoiceStatus,
  ): Promise<Invoice> {
    if (amount <= 0) throw new BadRequestError('Amount must be greater than 0');

    // Default to the restaurant's own subscription if none supplied
    let subId = subscriptionId ?? null;
    if (!subId) {
      const sub = await subscriptionsRepository.findByRestaurantId(restaurantId);
      subId = sub?.id ?? null;
    }

    // Invoice number is generated atomically inside createInvoice (DB subquery)
    // — no separate generateInvoiceNumber() call needed.
    return subscriptionsRepository.createInvoice(
      restaurantId,
      subId,
      amount,
      dueDate ? new Date(dueDate) : null,
      status,
      notes ?? null,
    );
  }

  /**
   * Mark an invoice paid. Verifies the invoice belongs to the restaurant unless
   * called by a super-admin (restaurantId = null bypasses the tenant check).
   * Paying an invoice also re-activates the subscription if it was in grace.
   */
  async markInvoicePaid(invoiceId: string, restaurantId: string | null): Promise<Invoice> {
    const invoice = await subscriptionsRepository.findInvoiceById(invoiceId);
    if (!invoice || (restaurantId !== null && invoice.restaurant_id !== restaurantId)) {
      throw new NotFoundError('Invoice not found');
    }
    if (invoice.status === 'PAID') {
      return invoice; // idempotent
    }
    if (invoice.status === 'CANCELLED') {
      throw new BadRequestError('Cannot mark a cancelled invoice as paid');
    }

    const paid = await subscriptionsRepository.markInvoicePaid(invoiceId);
    if (!paid) throw new NotFoundError('Invoice not found');

    // Reactivate the subscription out of grace/suspended on payment.
    const sub = await subscriptionsRepository.findByRestaurantId(invoice.restaurant_id);
    if (sub && (sub.status === 'GRACE_PERIOD' || sub.status === 'SUSPENDED')) {
      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setMonth(expiresAt.getMonth() + 1);
      await subscriptionsRepository.update(sub.id, {
        status: 'ACTIVE',
        started_at: now,
        expires_at: expiresAt,
        grace_period_ends_at: null,
      });
    }

    return paid;
  }

  // ── Super-admin platform metrics ──────────────────────────────────────────

  async getPlatformMetrics(): Promise<PlatformMetrics> {
    return subscriptionsRepository.getPlatformMetrics();
  }

  /**
   * Get ALL restaurants with their subscription status and basic stats.
   * Used by the super-admin panel to manage the entire platform.
   */
  async getAllRestaurantsWithStatus(
    search?: string,
    statusFilter?: string,
    limit = 50,
    offset = 0,
  ): Promise<{ restaurants: any[]; total: number }> {
    const { query: dbQuery } = await import('@/config/database');

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let pIdx = 1;

    if (search) {
      whereClause += ` AND (r.name ILIKE $${pIdx} OR r.slug ILIKE $${pIdx})`;
      params.push(`%${search}%`);
      pIdx++;
    }
    if (statusFilter && statusFilter !== 'ALL') {
      whereClause += ` AND s.status = $${pIdx}`;
      params.push(statusFilter);
      pIdx++;
    }

    const countRes = await dbQuery(
      `SELECT COUNT(*) as total FROM restaurants r
       LEFT JOIN subscriptions s ON s.restaurant_id = r.id
       ${whereClause}`,
      params,
    );
    const total = parseInt(countRes.rows[0].total, 10) || 0;

    const result = await dbQuery(
      `SELECT
         r.id, r.name, r.slug, r.created_at,
         s.status AS subscription_status,
         s.plan_id,
         s.trial_ends_at,
         s.expires_at,
         p.name AS plan_name,
         p.price AS plan_price,
         (SELECT COUNT(*) FROM users u WHERE u.restaurant_id = r.id) AS user_count,
         (SELECT COUNT(*) FROM orders o WHERE o.restaurant_id = r.id AND DATE(o.created_at) = CURRENT_DATE) AS orders_today,
         (SELECT COALESCE(SUM(o.total_amount), 0) FROM orders o WHERE o.restaurant_id = r.id AND o.status = 'COMPLETED' AND DATE(o.created_at) = CURRENT_DATE) AS revenue_today
       FROM restaurants r
       LEFT JOIN subscriptions s ON s.restaurant_id = r.id
       LEFT JOIN subscription_plans p ON p.id = s.plan_id
       ${whereClause}
       ORDER BY r.created_at DESC
       LIMIT $${pIdx} OFFSET $${pIdx + 1}`,
      [...params, limit, offset],
    );

    return { restaurants: result.rows, total };
  }

  /**
   * Suspend a restaurant's subscription (super-admin action).
   * Makes the restaurant read-only.
   */
  async suspendRestaurant(restaurantId: string): Promise<void> {
    const sub = await subscriptionsRepository.findByRestaurantId(restaurantId);
    if (!sub) throw new BadRequestError('No subscription found for this restaurant');
    await subscriptionsRepository.updateStatus(sub.id, 'SUSPENDED');

    // Revoke all refresh tokens for every user in this restaurant.
    // Their current access tokens (≤15m) expire naturally — no per-request DB hit.
    // On next token rotation the refresh token is rejected, forcing re-login,
    // at which point checkSubscription blocks the login response.
    await authRepository.revokeAllRefreshTokensForRestaurant(restaurantId);
  }

  /**
   * Activate/reactivate a restaurant's subscription (super-admin action).
   * Sets status to ACTIVE with a 30-day window.
   */
  async activateRestaurant(restaurantId: string, planId?: string): Promise<void> {
    let sub = await subscriptionsRepository.findByRestaurantId(restaurantId);
    if (!sub) {
      sub = await subscriptionsRepository.createTrial(restaurantId, 14);
    }
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    await subscriptionsRepository.update(sub.id, {
      status: 'ACTIVE',
      started_at: new Date(),
      expires_at: expiresAt,
      grace_period_ends_at: null,
      ...(planId ? { plan_id: planId } : {}),
    });
  }

  /**
   * Generate an invoice for a restaurant (super-admin action).
   */
  async generateInvoiceForRestaurant(
    restaurantId: string,
    amount: number,
    notes?: string,
  ): Promise<Invoice> {
    const sub = await subscriptionsRepository.findByRestaurantId(restaurantId);
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7); // 7 days to pay
    return subscriptionsRepository.createInvoice(
      restaurantId,
      sub?.id ?? null,
      amount,
      dueDate,
      'PENDING',
      notes ?? null,
    );
  }
}

export const subscriptionsService = new SubscriptionsService();
