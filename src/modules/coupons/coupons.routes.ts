/**
 * Coupons.
 *
 *   Public (customer):
 *     POST /api/v1/public/site/:slug/coupon/validate  { code, order_total }
 *       -> { valid, discount, code, message }
 *
 *   Owner/staff:
 *     GET/POST/PATCH/DELETE /api/v1/coupons
 *
 * Validation computes the discount but does NOT consume the coupon — the
 * redemption is recorded when the order is actually placed (increment used_count).
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query, withTenant } from '@/config/database';
import { successResponse } from '@/shared/utils/responseHandler';
import { NotFoundError } from '@/shared/errors/AppError';
import { authenticate, AuthenticatedRequest } from '@/shared/middleware/authenticate';
import { authorize } from '@/shared/middleware/authorize';
import { checkSubscription } from '@/shared/middleware/checkSubscription';

/**
 * Pure discount calculation, shared by the public validate endpoint and order
 * placement. Returns the rupee discount (>= 0) or a reason it doesn't apply.
 */
export function computeCouponDiscount(
  coupon: {
    discount_type: 'FLAT' | 'PERCENT';
    discount_value: number;
    min_order: number;
    max_discount: number | null;
    usage_limit: number | null;
    used_count: number;
    valid_from: string | null;
    valid_until: string | null;
    is_active: boolean;
  },
  orderTotal: number,
  now: Date = new Date(),
): { valid: boolean; discount: number; message?: string } {
  if (!coupon.is_active) return { valid: false, discount: 0, message: 'Coupon is not active' };
  if (coupon.valid_from && now < new Date(coupon.valid_from)) return { valid: false, discount: 0, message: 'Coupon not yet valid' };
  if (coupon.valid_until && now > new Date(coupon.valid_until)) return { valid: false, discount: 0, message: 'Coupon has expired' };
  if (coupon.usage_limit != null && coupon.used_count >= coupon.usage_limit) return { valid: false, discount: 0, message: 'Coupon usage limit reached' };
  if (orderTotal < Number(coupon.min_order)) {
    return { valid: false, discount: 0, message: `Minimum order ₹${Number(coupon.min_order).toFixed(0)}` };
  }

  let discount =
    coupon.discount_type === 'PERCENT'
      ? (orderTotal * Number(coupon.discount_value)) / 100
      : Number(coupon.discount_value);

  if (coupon.max_discount != null) discount = Math.min(discount, Number(coupon.max_discount));
  discount = Math.min(discount, orderTotal); // never exceed the bill
  discount = Math.round(discount * 100) / 100;

  return { valid: true, discount };
}

// ── Public validate router (mounted under /public) ─────────────────────────────
export const publicCouponRouter = Router();

const ValidateSchema = z.object({
  code: z.string().min(1).max(40),
  order_total: z.number().min(0),
});

publicCouponRouter.post(
  '/site/:slug/coupon/validate',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = await query(`SELECT id FROM restaurants WHERE slug = $1 LIMIT 1`, [req.params.slug]);
      if (r.rows.length === 0) throw new NotFoundError('Restaurant not found');
      const restaurantId = r.rows[0].id;
      const { code, order_total } = ValidateSchema.parse(req.body);

      const c = await query(
        `SELECT * FROM coupons WHERE restaurant_id = $1 AND UPPER(code) = UPPER($2) LIMIT 1`,
        [restaurantId, code],
      );
      if (c.rows.length === 0) {
        res.json(successResponse({ valid: false, discount: 0, message: 'Invalid coupon code' }));
        return;
      }
      const result = computeCouponDiscount(c.rows[0], order_total);
      res.json(successResponse({ ...result, code: c.rows[0].code }));
    } catch (err) { next(err); }
  },
);

// ── Owner CRUD router (mounted at /coupons) ────────────────────────────────────
const router = Router();

router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const rows = await withTenant(req.user!.restaurantId, async (q) => {
      const result = await q(`SELECT * FROM coupons ORDER BY created_at DESC`);
      return result.rows;
    });
    res.json(successResponse(rows));
  } catch (err) { next(err); }
});

const CouponSchema = z.object({
  code: z.string().min(1).max(40),
  description: z.string().max(255).optional(),
  discount_type: z.enum(['FLAT', 'PERCENT']),
  discount_value: z.number().min(0),
  min_order: z.number().min(0).optional(),
  max_discount: z.number().min(0).optional(),
  usage_limit: z.number().int().min(1).optional(),
  valid_from: z.string().datetime().optional(),
  valid_until: z.string().datetime().optional(),
  is_active: z.boolean().optional(),
});

router.post('/', authenticate, authorize('ADMIN'), checkSubscription, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const b = CouponSchema.parse(req.body);
    const restaurantId = req.user!.restaurantId;
    const row = await withTenant(restaurantId, async (q) => {
      const result = await q(
        `INSERT INTO coupons
           (restaurant_id, code, description, discount_type, discount_value, min_order,
            max_discount, usage_limit, valid_from, valid_until, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [restaurantId, b.code.toUpperCase(), b.description ?? null, b.discount_type, b.discount_value,
         b.min_order ?? 0, b.max_discount ?? null, b.usage_limit ?? null,
         b.valid_from ?? null, b.valid_until ?? null, b.is_active ?? true],
      );
      return result.rows[0];
    });
    res.status(201).json(successResponse(row, { message: 'Coupon created' }));
  } catch (err) { next(err); }
});

router.patch('/:id', authenticate, authorize('ADMIN'), checkSubscription, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const b = CouponSchema.partial().parse(req.body);
    const restaurantId = req.user!.restaurantId;
    const row = await withTenant(restaurantId, async (q) => {
      const result = await q(
        `UPDATE coupons SET
           description = COALESCE($2, description),
           discount_type = COALESCE($3, discount_type),
           discount_value = COALESCE($4, discount_value),
           min_order = COALESCE($5, min_order),
           max_discount = COALESCE($6, max_discount),
           usage_limit = COALESCE($7, usage_limit),
           valid_from = COALESCE($8, valid_from),
           valid_until = COALESCE($9, valid_until),
           is_active = COALESCE($10, is_active),
           updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        [req.params.id, b.description ?? null, b.discount_type ?? null, b.discount_value ?? null,
         b.min_order ?? null, b.max_discount ?? null, b.usage_limit ?? null,
         b.valid_from ?? null, b.valid_until ?? null, b.is_active ?? null],
      );
      return result.rows[0];
    });
    if (!row) throw new NotFoundError('Coupon not found');
    res.json(successResponse(row, { message: 'Coupon updated' }));
  } catch (err) { next(err); }
});

router.delete('/:id', authenticate, authorize('ADMIN'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const deleted = await withTenant(req.user!.restaurantId, async (q) => {
      const result = await q(`DELETE FROM coupons WHERE id = $1 RETURNING id`, [req.params.id]);
      return result.rows[0];
    });
    if (!deleted) throw new NotFoundError('Coupon not found');
    res.json(successResponse({ id: deleted.id }, { message: 'Coupon deleted' }));
  } catch (err) { next(err); }
});

export default router;
