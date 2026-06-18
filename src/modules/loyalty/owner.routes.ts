/**
 * Owner-side reviews moderation + loyalty configuration.
 *
 *   GET   /api/v1/reviews                 — all reviews (incl. hidden)
 *   PATCH /api/v1/reviews/:id             { is_published }  — show/hide
 *   DELETE/api/v1/reviews/:id             — remove
 *   GET   /api/v1/loyalty/config          — current loyalty settings
 *   PATCH /api/v1/loyalty/config          { loyalty_enabled, points_per_currency, redeem_value }
 *
 * All restaurant-scoped via the staff JWT + withTenant (RLS-enforced).
 */

import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { withTenant } from '@/config/database';
import { successResponse } from '@/shared/utils/responseHandler';
import { NotFoundError } from '@/shared/errors/AppError';
import { authenticate, AuthenticatedRequest } from '@/shared/middleware/authenticate';
import { authorize } from '@/shared/middleware/authorize';

// ── Reviews moderation router (mounted at /reviews) ────────────────────────────
export const ownerReviewsRouter = Router();

ownerReviewsRouter.get('/', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const rows = await withTenant(req.user!.restaurantId, async (q) => {
      const r = await q(
        `SELECT rv.id, rv.rating, rv.title, rv.body, rv.is_published, rv.created_at, c.name AS customer_name
         FROM reviews rv LEFT JOIN customers c ON c.id = rv.customer_id
         ORDER BY rv.created_at DESC LIMIT 200`,
      );
      return r.rows;
    });
    res.json(successResponse(rows));
  } catch (err) { next(err); }
});

const ModerateSchema = z.object({ is_published: z.boolean() });
ownerReviewsRouter.patch('/:id', authenticate, authorize('ADMIN'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { is_published } = ModerateSchema.parse(req.body);
    const row = await withTenant(req.user!.restaurantId, async (q) => {
      const r = await q(
        `UPDATE reviews SET is_published = $1, updated_at = NOW() WHERE id = $2 RETURNING id, is_published`,
        [is_published, req.params.id],
      );
      return r.rows[0];
    });
    if (!row) throw new NotFoundError('Review not found');
    res.json(successResponse(row, { message: is_published ? 'Review published' : 'Review hidden' }));
  } catch (err) { next(err); }
});

ownerReviewsRouter.delete('/:id', authenticate, authorize('ADMIN'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const row = await withTenant(req.user!.restaurantId, async (q) => {
      const r = await q(`DELETE FROM reviews WHERE id = $1 RETURNING id`, [req.params.id]);
      return r.rows[0];
    });
    if (!row) throw new NotFoundError('Review not found');
    res.json(successResponse({ id: row.id }, { message: 'Review deleted' }));
  } catch (err) { next(err); }
});

// ── Loyalty config router (mounted at /loyalty) ────────────────────────────────
export const loyaltyConfigRouter = Router();

loyaltyConfigRouter.get('/config', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const row = await withTenant(req.user!.restaurantId, async (q) => {
      const r = await q(
        `SELECT loyalty_enabled, loyalty_points_per_currency, loyalty_redeem_value
         FROM restaurants WHERE id = $1`,
        [req.user!.restaurantId],
      );
      return r.rows[0];
    });
    res.json(successResponse(row));
  } catch (err) { next(err); }
});

const LoyaltyConfigSchema = z.object({
  loyalty_enabled: z.boolean().optional(),
  loyalty_points_per_currency: z.number().min(0).max(100).optional(),
  loyalty_redeem_value: z.number().min(0).max(1000).optional(),
});

loyaltyConfigRouter.patch('/config', authenticate, authorize('ADMIN'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const b = LoyaltyConfigSchema.parse(req.body);
    const row = await withTenant(req.user!.restaurantId, async (q) => {
      const r = await q(
        `UPDATE restaurants SET
           loyalty_enabled = COALESCE($2, loyalty_enabled),
           loyalty_points_per_currency = COALESCE($3, loyalty_points_per_currency),
           loyalty_redeem_value = COALESCE($4, loyalty_redeem_value),
           updated_at = NOW()
         WHERE id = $1
         RETURNING loyalty_enabled, loyalty_points_per_currency, loyalty_redeem_value`,
        [req.user!.restaurantId, b.loyalty_enabled ?? null,
         b.loyalty_points_per_currency ?? null, b.loyalty_redeem_value ?? null],
      );
      return r.rows[0];
    });
    res.json(successResponse(row, { message: 'Loyalty settings updated' }));
  } catch (err) { next(err); }
});
