/**
 * Onboarding — public endpoint to register a new restaurant + admin user.
 *
 * This solves the chicken-and-egg problem:
 *   - The existing POST /restaurants requires an authenticated ADMIN
 *   - But to become an ADMIN you need a restaurant to belong to
 *
 * This endpoint creates both in a single transaction:
 *   1. Creates the restaurant (with auto-generated slug)
 *   2. Creates the first ADMIN user for that restaurant
 *   3. Returns a JWT token so the admin is immediately logged in
 *
 * Rate limited to prevent abuse (5 registrations per hour per IP).
 *
 * POST /api/v1/onboarding/register
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '@/config/database';
import { successResponse } from '@/shared/utils/responseHandler';
import { ConflictError, BadRequestError } from '@/shared/errors/AppError';
import { env } from '@/config/env';
import rateLimit from 'express-rate-limit';
import { subscriptionsService } from '@/modules/subscriptions/subscriptions.service';

const router = Router();

// Strict rate limit — 5 new restaurants per hour per IP
const onboardingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    error: { code: 'TOO_MANY_REQUESTS', message: 'Too many registrations. Try again later.' },
  },
  skip: () => env.NODE_ENV === 'test',
});

// ── Validation schema ─────────────────────────────────────────────────────────

const OnboardingSchema = z.object({
  // Restaurant details
  restaurant_name: z
    .string()
    .min(2, 'Restaurant name must be at least 2 characters')
    .max(100, 'Restaurant name must be under 100 characters')
    .trim(),

  // Admin user details
  admin_name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100)
    .trim(),
  admin_email: z
    .string()
    .email('Invalid email address')
    .toLowerCase()
    .trim(),
  admin_password: z
    .string()
    .min(8, 'Password must be at least 8 characters'),

  // Optional restaurant settings
  qr_mode: z.enum(['restaurant', 'mall']).default('restaurant'),
  delay_threshold_minutes: z.number().int().min(5).max(120).default(15),
});

// ── Slug generator ────────────────────────────────────────────────────────────

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

// ── POST /api/v1/onboarding/register ─────────────────────────────────────────

router.post('/register', onboardingLimiter, async (req: Request, res: Response, next: NextFunction) => {
  const client = await pool.connect();

  try {
    const payload = OnboardingSchema.parse(req.body);

    // Check if email is already taken (across all restaurants)
    const emailCheck = await client.query(
      'SELECT 1 FROM users WHERE email = $1 LIMIT 1',
      [payload.admin_email],
    );
    if (emailCheck.rows.length > 0) {
      throw new ConflictError('An account with this email already exists');
    }

    await client.query('BEGIN');

    // ── 1. Generate unique slug ───────────────────────────────────────────────
    let slug = generateSlug(payload.restaurant_name);
    if (!slug || slug.length < 2) slug = 'restaurant';

    let counter = 1;
    const baseSlug = slug;
    while (true) {
      const exists = await client.query(
        'SELECT 1 FROM restaurants WHERE slug = $1 LIMIT 1',
        [slug],
      );
      if (exists.rows.length === 0) break;
      slug = `${baseSlug}-${counter++}`;
      if (counter > 100) throw new BadRequestError('Could not generate unique slug');
    }

    // ── 2. Create restaurant ──────────────────────────────────────────────────
    const restaurantResult = await client.query(
      `INSERT INTO restaurants (name, slug, qr_mode, delay_threshold_minutes, auto_approve_online_orders)
       VALUES ($1, $2, $3, $4, FALSE)
       RETURNING id, name, slug, qr_mode, delay_threshold_minutes, created_at`,
      [payload.restaurant_name, slug, payload.qr_mode, payload.delay_threshold_minutes],
    );
    const restaurant = restaurantResult.rows[0];

    // ── 3. Create admin user ──────────────────────────────────────────────────
    const salt = await bcryptjs.genSalt(10);
    const passwordHash = await bcryptjs.hash(payload.admin_password, salt);

    const userResult = await client.query(
      `INSERT INTO users (restaurant_id, email, password_hash, name, role, is_active)
       VALUES ($1, $2, $3, $4, 'ADMIN', TRUE)
       RETURNING id, email, name, role, restaurant_id`,
      [restaurant.id, payload.admin_email, passwordHash, payload.admin_name],
    );
    const user = userResult.rows[0];

    await client.query('COMMIT');

    // ── Start the 14-day free trial for the new restaurant ────────────────────
    // Done after commit so a subscription hiccup never rolls back signup.
    try {
      await subscriptionsService.startTrial(restaurant.id);
    } catch (subErr) {
      console.error('[Onboarding] Trial creation failed (non-fatal):', subErr);
    }

    // ── 4. Issue JWT so admin is immediately logged in ────────────────────────
    const jwtPayload = {
      id:           user.id,
      email:        user.email,
      role:         user.role,
      restaurantId: user.restaurant_id,
    };

    const token = jwt.sign(jwtPayload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as any,
      algorithm: 'HS256',
    });
    const refreshToken = jwt.sign(jwtPayload, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN as any,
      algorithm: 'HS256',
    });

    console.log(`[Onboarding] ✅ New restaurant: "${restaurant.name}" (${restaurant.slug}) — admin: ${user.email}`);

    res.status(201).json(
      successResponse(
        {
          restaurant: {
            id:   restaurant.id,
            name: restaurant.name,
            slug: restaurant.slug,
          },
          token,
          refreshToken,
          user: {
            id:            user.id,
            email:         user.email,
            name:          user.name,
            role:          user.role,
            restaurant_id: user.restaurant_id,
          },
        },
        { message: 'Restaurant registered successfully' },
      ),
    );
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
});

export default router;
