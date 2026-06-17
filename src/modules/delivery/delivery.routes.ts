/**
 * Delivery zones (named locality/pincode -> fee).
 *
 *   Public (customer):
 *     GET /api/v1/public/site/:slug/delivery-quote?pincode=560034
 *       -> { deliverable, fee, min_order, eta_minutes, zone_name } | { deliverable:false }
 *
 *   Owner/staff (authenticated):
 *     GET    /api/v1/delivery-zones
 *     POST   /api/v1/delivery-zones
 *     PATCH  /api/v1/delivery-zones/:id
 *     DELETE /api/v1/delivery-zones/:id
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query, withTenant } from '@/config/database';
import { successResponse } from '@/shared/utils/responseHandler';
import { NotFoundError } from '@/shared/errors/AppError';
import { authenticate, AuthenticatedRequest } from '@/shared/middleware/authenticate';
import { authorize } from '@/shared/middleware/authorize';
import { checkSubscription } from '@/shared/middleware/checkSubscription';

// ── Public quote router (mounted under /public) ────────────────────────────────
export const publicDeliveryRouter = Router();

publicDeliveryRouter.get(
  '/site/:slug/delivery-quote',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const pincode = typeof req.query.pincode === 'string' ? req.query.pincode.trim() : '';
      const r = await query(`SELECT id FROM restaurants WHERE slug = $1 LIMIT 1`, [req.params.slug]);
      if (r.rows.length === 0) throw new NotFoundError('Restaurant not found');
      const restaurantId = r.rows[0].id;

      // Exact pincode match first; fall back to "no zone => not deliverable".
      const result = await query(
        `SELECT name, fee, min_order, eta_minutes
         FROM delivery_zones
         WHERE restaurant_id = $1 AND is_active = TRUE AND pincode = $2
         ORDER BY fee ASC LIMIT 1`,
        [restaurantId, pincode],
      );

      if (result.rows.length === 0) {
        res.json(successResponse({ deliverable: false }));
        return;
      }
      const z = result.rows[0];
      res.json(successResponse({
        deliverable: true,
        zone_name: z.name,
        fee: Number(z.fee),
        min_order: Number(z.min_order),
        eta_minutes: z.eta_minutes,
      }));
    } catch (err) { next(err); }
  },
);

// ── Owner CRUD router (mounted at /delivery-zones) ─────────────────────────────
const router = Router();

router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const rows = await withTenant(req.user!.restaurantId, async (q) => {
      const result = await q(`SELECT * FROM delivery_zones ORDER BY name ASC`);
      return result.rows;
    });
    res.json(successResponse(rows));
  } catch (err) { next(err); }
});

const ZoneSchema = z.object({
  name: z.string().min(1).max(120),
  pincode: z.string().max(12).optional(),
  fee: z.number().min(0),
  min_order: z.number().min(0).optional(),
  eta_minutes: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

router.post('/', authenticate, authorize('ADMIN'), checkSubscription, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const body = ZoneSchema.parse(req.body);
    const restaurantId = req.user!.restaurantId;
    const row = await withTenant(restaurantId, async (q) => {
      const result = await q(
        `INSERT INTO delivery_zones (restaurant_id, name, pincode, fee, min_order, eta_minutes, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [restaurantId, body.name, body.pincode ?? null, body.fee, body.min_order ?? 0,
         body.eta_minutes ?? null, body.is_active ?? true],
      );
      return result.rows[0];
    });
    res.status(201).json(successResponse(row, { message: 'Zone created' }));
  } catch (err) { next(err); }
});

router.patch('/:id', authenticate, authorize('ADMIN'), checkSubscription, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const body = ZoneSchema.partial().parse(req.body);
    const restaurantId = req.user!.restaurantId;
    const row = await withTenant(restaurantId, async (q) => {
      const result = await q(
        `UPDATE delivery_zones SET
           name = COALESCE($2, name),
           pincode = COALESCE($3, pincode),
           fee = COALESCE($4, fee),
           min_order = COALESCE($5, min_order),
           eta_minutes = COALESCE($6, eta_minutes),
           is_active = COALESCE($7, is_active),
           updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        [req.params.id, body.name ?? null, body.pincode ?? null, body.fee ?? null,
         body.min_order ?? null, body.eta_minutes ?? null, body.is_active ?? null],
      );
      return result.rows[0];
    });
    if (!row) throw new NotFoundError('Zone not found');
    res.json(successResponse(row, { message: 'Zone updated' }));
  } catch (err) { next(err); }
});

router.delete('/:id', authenticate, authorize('ADMIN'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const restaurantId = req.user!.restaurantId;
    const deleted = await withTenant(restaurantId, async (q) => {
      const result = await q(`DELETE FROM delivery_zones WHERE id = $1 RETURNING id`, [req.params.id]);
      return result.rows[0];
    });
    if (!deleted) throw new NotFoundError('Zone not found');
    res.json(successResponse({ id: deleted.id }, { message: 'Zone deleted' }));
  } catch (err) { next(err); }
});

export default router;
