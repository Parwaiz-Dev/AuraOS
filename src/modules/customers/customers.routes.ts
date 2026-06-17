/**
 * Customer-facing account routes (public-ish — OTP login, then customer JWT).
 *
 *   POST /api/v1/customers/otp/request   { phone }            — send login code
 *   POST /api/v1/customers/otp/verify    { phone, code }      — get token
 *   GET  /api/v1/customers/me                                 — profile (auth)
 *   PATCH/api/v1/customers/me            { name, email }      — update (auth)
 *   GET  /api/v1/customers/me/orders?slug=...                 — order history (auth)
 *   GET  /api/v1/customers/me/addresses?slug=...              — list (auth)
 *   POST /api/v1/customers/me/addresses  { slug, ... }        — add (auth)
 */

import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query, withTenant } from '@/config/database';
import { successResponse } from '@/shared/utils/responseHandler';
import { BadRequestError, NotFoundError } from '@/shared/errors/AppError';
import { customerAuthService } from '@/modules/customers/customer-auth.service';
import { authenticateCustomer, type CustomerRequest } from '@/shared/middleware/authenticateCustomer';
import { otpRequestRateLimiter } from '@/shared/middleware/rateLimiter';

const router = Router();

// ── OTP login ──────────────────────────────────────────────────────────────────
const RequestOtpSchema = z.object({ phone: z.string().min(8).max(20) });
router.post('/otp/request', otpRequestRateLimiter, async (req, res: Response, next: NextFunction) => {
  try {
    const { phone } = RequestOtpSchema.parse(req.body);
    const result = await customerAuthService.requestOtp(phone);
    res.json(successResponse({ sent: true, ...result }, { message: 'OTP sent' }));
  } catch (err) { next(err); }
});

const VerifyOtpSchema = z.object({ phone: z.string().min(8).max(20), code: z.string().length(6) });
router.post('/otp/verify', otpRequestRateLimiter, async (req, res: Response, next: NextFunction) => {
  try {
    const { phone, code } = VerifyOtpSchema.parse(req.body);
    const result = await customerAuthService.verifyOtp(phone, code);
    res.json(successResponse(result, { message: 'Logged in' }));
  } catch (err) { next(err); }
});

// ── Profile ──────────────────────────────────────────────────────────────────
router.get('/me', authenticateCustomer, async (req: CustomerRequest, res: Response, next: NextFunction) => {
  try {
    const r = await query(`SELECT id, phone, name, email FROM customers WHERE id = $1`, [req.customer!.customerId]);
    if (r.rows.length === 0) throw new NotFoundError('Customer not found');
    res.json(successResponse(r.rows[0]));
  } catch (err) { next(err); }
});

const UpdateMeSchema = z.object({ name: z.string().max(120).optional(), email: z.string().email().max(255).optional() });
router.patch('/me', authenticateCustomer, async (req: CustomerRequest, res: Response, next: NextFunction) => {
  try {
    const body = UpdateMeSchema.parse(req.body);
    const r = await query(
      `UPDATE customers SET name = COALESCE($2, name), email = COALESCE($3, email), updated_at = NOW()
       WHERE id = $1 RETURNING id, phone, name, email`,
      [req.customer!.customerId, body.name ?? null, body.email ?? null],
    );
    res.json(successResponse(r.rows[0]));
  } catch (err) { next(err); }
});

// ── Order history (tenant-scoped via ?slug) ────────────────────────────────────
async function restaurantIdFromSlug(slug: string): Promise<string> {
  const r = await query(`SELECT id FROM restaurants WHERE slug = $1 LIMIT 1`, [slug]);
  if (r.rows.length === 0) throw new NotFoundError('Restaurant not found');
  return r.rows[0].id;
}

router.get('/me/orders', authenticateCustomer, async (req: CustomerRequest, res: Response, next: NextFunction) => {
  try {
    const slug = String(req.query.slug || '');
    if (!slug) throw new BadRequestError('slug is required');
    const restaurantId = await restaurantIdFromSlug(slug);
    const rows = await withTenant(restaurantId, async (q) => {
      const r = await q(
        `SELECT id, order_number, status, total_amount, token_number, created_at
         FROM orders WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 50`,
        [req.customer!.customerId],
      );
      return r.rows;
    });
    res.json(successResponse(rows));
  } catch (err) { next(err); }
});

// ── Addresses (tenant-scoped) ──────────────────────────────────────────────────
router.get('/me/addresses', authenticateCustomer, async (req: CustomerRequest, res: Response, next: NextFunction) => {
  try {
    const slug = String(req.query.slug || '');
    if (!slug) throw new BadRequestError('slug is required');
    const restaurantId = await restaurantIdFromSlug(slug);
    const rows = await withTenant(restaurantId, async (q) => {
      const r = await q(
        `SELECT id, label, line1, line2, city, pincode, latitude, longitude, is_default
         FROM customer_addresses WHERE customer_id = $1 ORDER BY is_default DESC, created_at DESC`,
        [req.customer!.customerId],
      );
      return r.rows;
    });
    res.json(successResponse(rows));
  } catch (err) { next(err); }
});

const AddAddressSchema = z.object({
  slug: z.string().min(1),
  label: z.string().max(40).optional(),
  line1: z.string().min(1).max(255),
  line2: z.string().max(255).optional(),
  city: z.string().max(120).optional(),
  pincode: z.string().max(12).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  is_default: z.boolean().optional(),
});
router.post('/me/addresses', authenticateCustomer, async (req: CustomerRequest, res: Response, next: NextFunction) => {
  try {
    const body = AddAddressSchema.parse(req.body);
    const restaurantId = await restaurantIdFromSlug(body.slug);
    const customerId = req.customer!.customerId;
    const row = await withTenant(restaurantId, async (q) => {
      if (body.is_default) {
        await q(`UPDATE customer_addresses SET is_default = FALSE WHERE customer_id = $1`, [customerId]);
      }
      const r = await q(
        `INSERT INTO customer_addresses
           (customer_id, restaurant_id, label, line1, line2, city, pincode, latitude, longitude, is_default)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, label, line1, line2, city, pincode, latitude, longitude, is_default`,
        [customerId, restaurantId, body.label ?? null, body.line1, body.line2 ?? null, body.city ?? null,
         body.pincode ?? null, body.latitude ?? null, body.longitude ?? null, body.is_default ?? false],
      );
      return r.rows[0];
    });
    res.status(201).json(successResponse(row, { message: 'Address added' }));
  } catch (err) { next(err); }
});

export default router;
