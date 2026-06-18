/**
 * Customer engagement: loyalty balance, favorites, and reviews.
 * All scoped to a restaurant via ?slug / body.slug and the customer JWT.
 *
 *   GET  /api/v1/customers/me/loyalty?slug=         — balance + recent ledger
 *   GET  /api/v1/customers/me/favorites?slug=       — favorite menu items
 *   POST /api/v1/customers/me/favorites             { slug, menu_item_id }
 *   DELETE /api/v1/customers/me/favorites/:itemId?slug=
 *   POST /api/v1/customers/me/reviews               { slug, rating, title?, body?, order_id? }
 *
 * Public review listing lives in site.routes (no auth).
 */

import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query, withTenant } from '@/config/database';
import { successResponse } from '@/shared/utils/responseHandler';
import { BadRequestError, NotFoundError } from '@/shared/errors/AppError';
import { authenticateCustomer, type CustomerRequest } from '@/shared/middleware/authenticateCustomer';

const router = Router();

async function restaurantIdFromSlug(slug: string): Promise<string> {
  const r = await query(`SELECT id FROM restaurants WHERE slug = $1 LIMIT 1`, [slug]);
  if (r.rows.length === 0) throw new NotFoundError('Restaurant not found');
  return r.rows[0].id;
}

function requireSlug(raw: unknown): string {
  const slug = typeof raw === 'string' ? raw : '';
  if (!slug) throw new BadRequestError('slug is required');
  return slug;
}

// ── Loyalty ──────────────────────────────────────────────────────────────────
router.get('/me/loyalty', authenticateCustomer, async (req: CustomerRequest, res: Response, next: NextFunction) => {
  try {
    const restaurantId = await restaurantIdFromSlug(requireSlug(req.query.slug));
    const customerId = req.customer!.customerId;
    const data = await withTenant(restaurantId, async (q) => {
      const acct = await q(
        `SELECT points_balance FROM loyalty_accounts WHERE customer_id = $1 LIMIT 1`,
        [customerId],
      );
      const ledger = await q(
        `SELECT points, reason, created_at FROM loyalty_ledger
         WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 20`,
        [customerId],
      );
      return { balance: acct.rows[0]?.points_balance ?? 0, ledger: ledger.rows };
    });
    res.json(successResponse(data));
  } catch (err) { next(err); }
});

// ── Favorites ────────────────────────────────────────────────────────────────
router.get('/me/favorites', authenticateCustomer, async (req: CustomerRequest, res: Response, next: NextFunction) => {
  try {
    const restaurantId = await restaurantIdFromSlug(requireSlug(req.query.slug));
    const customerId = req.customer!.customerId;
    const rows = await withTenant(restaurantId, async (q) => {
      const r = await q(
        `SELECT f.menu_item_id, m.name, m.price
         FROM favorites f JOIN menu_items m ON m.id = f.menu_item_id
         WHERE f.customer_id = $1 ORDER BY f.created_at DESC`,
        [customerId],
      );
      return r.rows;
    });
    res.json(successResponse(rows));
  } catch (err) { next(err); }
});

const AddFavoriteSchema = z.object({ slug: z.string().min(1), menu_item_id: z.string().uuid() });
router.post('/me/favorites', authenticateCustomer, async (req: CustomerRequest, res: Response, next: NextFunction) => {
  try {
    const b = AddFavoriteSchema.parse(req.body);
    const restaurantId = await restaurantIdFromSlug(b.slug);
    const customerId = req.customer!.customerId;
    await withTenant(restaurantId, async (q) => {
      // Ensure the item belongs to this restaurant (RLS already scopes it).
      const item = await q(`SELECT id FROM menu_items WHERE id = $1 LIMIT 1`, [b.menu_item_id]);
      if (item.rows.length === 0) throw new BadRequestError('Menu item not found');
      await q(
        `INSERT INTO favorites (restaurant_id, customer_id, menu_item_id)
         VALUES ($1, $2, $3) ON CONFLICT (customer_id, menu_item_id) DO NOTHING`,
        [restaurantId, customerId, b.menu_item_id],
      );
    });
    res.status(201).json(successResponse({ favorited: true }));
  } catch (err) { next(err); }
});

router.delete('/me/favorites/:itemId', authenticateCustomer, async (req: CustomerRequest, res: Response, next: NextFunction) => {
  try {
    const restaurantId = await restaurantIdFromSlug(requireSlug(req.query.slug));
    const customerId = req.customer!.customerId;
    await withTenant(restaurantId, async (q) => {
      await q(`DELETE FROM favorites WHERE customer_id = $1 AND menu_item_id = $2`, [customerId, req.params.itemId]);
    });
    res.json(successResponse({ favorited: false }));
  } catch (err) { next(err); }
});

// ── Reviews (create) ─────────────────────────────────────────────────────────
const CreateReviewSchema = z.object({
  slug: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(120).optional(),
  body: z.string().max(2000).optional(),
  order_id: z.string().uuid().optional(),
  photo_urls: z.array(z.string().url()).max(6).optional(),
});
router.post('/me/reviews', authenticateCustomer, async (req: CustomerRequest, res: Response, next: NextFunction) => {
  try {
    const b = CreateReviewSchema.parse(req.body);
    const restaurantId = await restaurantIdFromSlug(b.slug);
    const customerId = req.customer!.customerId;
    const row = await withTenant(restaurantId, async (q) => {
      const r = await q(
        `INSERT INTO reviews (restaurant_id, customer_id, order_id, rating, title, body, photo_urls)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
         RETURNING id, rating, title, body, created_at`,
        [restaurantId, customerId, b.order_id ?? null, b.rating, b.title ?? null, b.body ?? null,
         JSON.stringify(b.photo_urls ?? [])],
      );
      return r.rows[0];
    });
    res.status(201).json(successResponse(row, { message: 'Review submitted' }));
  } catch (err) { next(err); }
});

export default router;
