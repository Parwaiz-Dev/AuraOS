/**
 * Reservations (table booking).
 *
 *   Public (customer):
 *     POST /api/v1/public/site/:slug/reservations   — request a booking
 *
 *   Owner/staff (authenticated, restaurant-scoped via JWT):
 *     GET   /api/v1/reservations            — list (optional ?status=)
 *     PATCH /api/v1/reservations/:id        — update status
 *
 * Owner endpoints use withTenant so RLS enforces isolation even though the
 * restaurant id comes from the trusted JWT.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query, withTenant } from '@/config/database';
import { successResponse } from '@/shared/utils/responseHandler';
import { NotFoundError, BadRequestError } from '@/shared/errors/AppError';
import { authenticate, AuthenticatedRequest } from '@/shared/middleware/authenticate';
import { authorize } from '@/shared/middleware/authorize';
import { publicOrderRateLimiter } from '@/shared/middleware/rateLimiter';
import { eventBroadcaster } from '@/shared/socket/eventBroadcaster';

// ── Public booking router (mounted under /public) ──────────────────────────────
export const publicReservationsRouter = Router();

const CreateReservationSchema = z.object({
  customer_name: z.string().min(1).max(120),
  customer_phone: z.string().min(8).max(20),
  party_size: z.number().int().min(1).max(100),
  reserved_for: z.string().datetime(), // ISO timestamp
  special_requests: z.string().max(1000).optional(),
});

publicReservationsRouter.post(
  '/site/:slug/reservations',
  publicOrderRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = await query(`SELECT id FROM restaurants WHERE slug = $1 LIMIT 1`, [req.params.slug]);
      if (r.rows.length === 0) throw new NotFoundError('Restaurant not found');
      const restaurantId = r.rows[0].id;

      const body = CreateReservationSchema.parse(req.body);
      if (new Date(body.reserved_for).getTime() < Date.now()) {
        throw new BadRequestError('Reservation time must be in the future');
      }

      // Optional: link to a logged-in customer if a token is present.
      let customerId: string | null = null;
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        try {
          const { verifyCustomerToken } = await import('@/modules/customers/customer-auth.service');
          customerId = verifyCustomerToken(authHeader.substring(7)).customerId;
        } catch { /* treat as guest */ }
      }

      const row = await withTenant(restaurantId, async (q) => {
        const ins = await q(
          `INSERT INTO reservations
             (restaurant_id, customer_id, customer_name, customer_phone, party_size, reserved_for, special_requests)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id, status, reserved_for, party_size`,
          [restaurantId, customerId, body.customer_name, body.customer_phone, body.party_size,
           body.reserved_for, body.special_requests ?? null],
        );
        return ins.rows[0];
      });

      // Notify the owner dashboard in real time (reuses restaurant room).
      eventBroadcaster?.broadcastReservationCreated({
        reservation_id: row.id,
        restaurant_id: restaurantId,
        status: row.status,
      });

      res.status(201).json(successResponse(row, { message: 'Reservation requested' }));
    } catch (err) { next(err); }
  },
);

// ── Owner management router (mounted at /reservations) ─────────────────────────
const router = Router();

router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const restaurantId = req.user!.restaurantId;
    const status = typeof req.query.status === 'string' ? req.query.status : null;
    const rows = await withTenant(restaurantId, async (q) => {
      const result = status
        ? await q(`SELECT * FROM reservations WHERE status = $1 ORDER BY reserved_for ASC`, [status])
        : await q(`SELECT * FROM reservations ORDER BY reserved_for ASC`);
      return result.rows;
    });
    res.json(successResponse(rows));
  } catch (err) { next(err); }
});

const UpdateStatusSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED']),
});

router.patch('/:id', authenticate, authorize('ADMIN', 'RECEPTION'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const restaurantId = req.user!.restaurantId;
    const { status } = UpdateStatusSchema.parse(req.body);
    const row = await withTenant(restaurantId, async (q) => {
      const result = await q(
        `UPDATE reservations SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [status, req.params.id],
      );
      return result.rows[0];
    });
    if (!row) throw new NotFoundError('Reservation not found');
    res.json(successResponse(row, { message: 'Reservation updated' }));
  } catch (err) { next(err); }
});

export default router;
