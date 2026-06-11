/**
 * Admin routes — super-admin platform management.
 *
 * Endpoints:
 *   POST /admin/create-restaurant   — create a restaurant + admin user + set features
 *   GET  /admin/restaurants/:id      — full detail of one restaurant (users, features, sub)
 *   PUT  /admin/restaurants/:id/features — update features for a restaurant
 *   GET  /admin/inquiries            — list contact form submissions
 *   PATCH /admin/inquiries/:id       — update inquiry status/notes
 *   GET  /admin/support-tickets      — list all support tickets
 *   PATCH /admin/support-tickets/:id — reply / change status
 *
 * Public (no auth):
 *   POST /admin/contact              — "Book a Demo" / "Contact AuraOS" form submission
 *
 * Restaurant-scoped (auth):
 *   POST /admin/support              — create a support ticket
 *   GET  /admin/my-tickets           — list own tickets
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import bcryptjs from 'bcryptjs';
import { pool, query } from '@/config/database';
import { authenticate, AuthenticatedRequest } from '@/shared/middleware/authenticate';
import { superAdmin } from '@/shared/middleware/superAdmin';
import { successResponse } from '@/shared/utils/responseHandler';
import { BadRequestError, NotFoundError } from '@/shared/errors/AppError';
import { subscriptionsService } from '@/modules/subscriptions/subscriptions.service';
import rateLimit from 'express-rate-limit';

const router = Router();

// Rate limit public contact form
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { success: false, error: { message: 'Too many submissions. Try again later.' } },
});

// ── PUBLIC: Contact form ─────────────────────────────────────────────────────

const ContactSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  phone: z.string().max(20).optional(),
  restaurant_name: z.string().max(255).optional(),
  message: z.string().max(1000).optional(),
});

router.post('/contact', contactLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = ContactSchema.parse(req.body);
    const result = await query(
      `INSERT INTO inquiries (name, email, phone, restaurant_name, message)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at`,
      [payload.name, payload.email, payload.phone || null, payload.restaurant_name || null, payload.message || null],
    );
    console.log(`[Admin] 📩 New inquiry from ${payload.name} (${payload.email})`);
    res.status(201).json(successResponse({ id: result.rows[0].id }, { message: 'Thank you! Our team will contact you soon.' }));
  } catch (err) { next(err); }
});

// ── RESTAURANT-SCOPED: Support tickets ───────────────────────────────────────

const TicketSchema = z.object({
  subject: z.string().min(3).max(255),
  message: z.string().min(10).max(2000),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional().default('NORMAL'),
});

router.post('/support', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const payload = TicketSchema.parse(req.body);
    const result = await query(
      `INSERT INTO support_tickets (restaurant_id, user_id, subject, message, priority)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, subject, status, priority, created_at`,
      [req.user!.restaurantId, req.user!.userId, payload.subject, payload.message, payload.priority],
    );
    res.status(201).json(successResponse(result.rows[0], { message: 'Support ticket created' }));
  } catch (err) { next(err); }
});

router.get('/my-tickets', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT id, subject, message, status, priority, admin_reply, created_at, resolved_at
       FROM support_tickets WHERE restaurant_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.user!.restaurantId],
    );
    res.json(successResponse(result.rows));
  } catch (err) { next(err); }
});

// ── SUPER-ADMIN: Create restaurant ──────────────────────────────────────────

const CreateRestaurantSchema = z.object({
  restaurant_name: z.string().min(2).max(100),
  admin_email: z.string().email(),
  admin_password: z.string().min(6),
  admin_name: z.string().min(2).max(100),
  plan_id: z.string().uuid().optional(),
  restaurant_type: z.enum(['FULL_SERVICE', 'QSR_SIMPLE', 'QSR_CHAIN', 'CAFE', 'CLOUD_KITCHEN', 'HYBRID']).optional().default('FULL_SERVICE'),
  features: z.object({
    kitchen_display: z.boolean().optional(),
    inventory: z.boolean().optional(),
    reports: z.boolean().optional(),
    qr_ordering: z.boolean().optional(),
    whatsapp: z.boolean().optional(),
    zomato: z.boolean().optional(),
    payments: z.boolean().optional(),
    waiter_app: z.boolean().optional(),
  }).optional(),
});

router.post('/create-restaurant', authenticate, superAdmin, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const client = await pool.connect();
  try {
    const payload = CreateRestaurantSchema.parse(req.body);

    // Check email uniqueness
    const emailCheck = await client.query('SELECT 1 FROM users WHERE email = $1', [payload.admin_email.toLowerCase()]);
    if (emailCheck.rows.length > 0) throw new BadRequestError('Email already registered');

    await client.query('BEGIN');

    // Generate slug
    let slug = payload.restaurant_name.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').slice(0, 60);
    let counter = 1;
    const baseSlug = slug;
    while (true) {
      const exists = await client.query('SELECT 1 FROM restaurants WHERE slug = $1', [slug]);
      if (exists.rows.length === 0) break;
      slug = `${baseSlug}-${counter++}`;
      if (counter > 100) throw new BadRequestError('Could not generate unique slug');
    }

    // Create restaurant with features
    const features = {
      kitchen_display: true, inventory: true, reports: true,
      qr_ordering: true, whatsapp: true, zomato: true,
      payments: true, waiter_app: true,
      ...(payload.features || {}),
    };

    const restResult = await client.query(
      `INSERT INTO restaurants (name, slug, features, restaurant_type) VALUES ($1, $2, $3, $4) RETURNING id, name, slug`,
      [payload.restaurant_name, slug, JSON.stringify(features), payload.restaurant_type],
    );
    const restaurant = restResult.rows[0];

    // Create admin user
    const hash = await bcryptjs.hash(payload.admin_password, await bcryptjs.genSalt(10));
    const userResult = await client.query(
      `INSERT INTO users (restaurant_id, email, password_hash, name, role, is_active)
       VALUES ($1, $2, $3, $4, 'ADMIN', TRUE) RETURNING id, email, name`,
      [restaurant.id, payload.admin_email.toLowerCase(), hash, payload.admin_name],
    );

    await client.query('COMMIT');

    // Create subscription (after commit so it doesn't block signup)
    await subscriptionsService.startTrial(restaurant.id);

    // If a plan was specified, activate it
    if (payload.plan_id) {
      try { await subscriptionsService.changePlan(restaurant.id, payload.plan_id); } catch {}
    }

    console.log(`[Admin] ✅ Created restaurant "${restaurant.name}" (${slug}) — admin: ${payload.admin_email}`);

    res.status(201).json(successResponse({
      restaurant,
      admin: userResult.rows[0],
      credentials: { email: payload.admin_email, password: '(as provided)' },
    }, { message: 'Restaurant created successfully' }));
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
});

// ── SUPER-ADMIN: Restaurant detail ──────────────────────────────────────────

router.get('/restaurants/:id', authenticate, superAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const restRes = await query(
      `SELECT id, name, slug, features, qr_mode, auto_approve_online_orders, delay_threshold_minutes, created_at
       FROM restaurants WHERE id = $1`, [id],
    );
    if (restRes.rows.length === 0) throw new NotFoundError('Restaurant not found');
    const restaurant = restRes.rows[0];

    const [usersRes, subRes, invoicesRes, ordersRes] = await Promise.all([
      query(`SELECT id, email, name, role, is_active, created_at FROM users WHERE restaurant_id = $1 ORDER BY created_at`, [id]),
      query(`SELECT s.*, p.name as plan_name, p.price as plan_price FROM subscriptions s LEFT JOIN subscription_plans p ON p.id = s.plan_id WHERE s.restaurant_id = $1`, [id]),
      query(`SELECT id, invoice_number, amount, status, due_date, paid_at, created_at FROM invoices WHERE restaurant_id = $1 ORDER BY created_at DESC LIMIT 20`, [id]),
      query(`SELECT COUNT(*) as total_orders, COALESCE(SUM(total_amount),0) as total_revenue FROM orders WHERE restaurant_id = $1 AND status IN ('PAYMENT_PENDING','COMPLETED')`, [id]),
    ]);

    res.json(successResponse({
      ...restaurant,
      users: usersRes.rows,
      subscription: subRes.rows[0] || null,
      invoices: invoicesRes.rows,
      stats: ordersRes.rows[0],
    }));
  } catch (err) { next(err); }
});

// ── SUPER-ADMIN: Update restaurant features ─────────────────────────────────

router.put('/restaurants/:id/features', authenticate, superAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const features = req.body.features;
    if (!features || typeof features !== 'object') throw new BadRequestError('features object required');
    await query(
      `UPDATE restaurants SET features = features || $1::jsonb, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(features), id],
    );
    res.json(successResponse({ message: 'Features updated' }));
  } catch (err) { next(err); }
});

// ── SUPER-ADMIN: Inquiries ──────────────────────────────────────────────────

router.get('/inquiries', authenticate, superAdmin, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT * FROM inquiries ORDER BY created_at DESC LIMIT 100`,
    );
    res.json(successResponse(result.rows));
  } catch (err) { next(err); }
});

router.patch('/inquiries/:id', authenticate, superAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, notes } = req.body;
    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;
    if (status) { fields.push(`status = $${i++}`); values.push(status); }
    if (notes !== undefined) { fields.push(`notes = $${i++}`); values.push(notes); }
    if (fields.length === 0) throw new BadRequestError('Nothing to update');
    fields.push('updated_at = NOW()');
    values.push(req.params.id);
    await query(`UPDATE inquiries SET ${fields.join(', ')} WHERE id = $${i}`, values);
    res.json(successResponse({ message: 'Inquiry updated' }));
  } catch (err) { next(err); }
});

// ── SUPER-ADMIN: Support tickets ────────────────────────────────────────────

router.get('/support-tickets', authenticate, superAdmin, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT t.*, r.name as restaurant_name, u.name as user_name, u.email as user_email
       FROM support_tickets t
       JOIN restaurants r ON r.id = t.restaurant_id
       JOIN users u ON u.id = t.user_id
       ORDER BY t.created_at DESC LIMIT 100`,
    );
    res.json(successResponse(result.rows));
  } catch (err) { next(err); }
});

router.patch('/support-tickets/:id', authenticate, superAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, admin_reply } = req.body;
    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;
    if (status) { fields.push(`status = $${i++}`); values.push(status); }
    if (admin_reply !== undefined) { fields.push(`admin_reply = $${i++}`); values.push(admin_reply); }
    if (status === 'RESOLVED') fields.push('resolved_at = NOW()');
    if (fields.length === 0) throw new BadRequestError('Nothing to update');
    fields.push('updated_at = NOW()');
    values.push(req.params.id);
    await query(`UPDATE support_tickets SET ${fields.join(', ')} WHERE id = $${i}`, values);
    res.json(successResponse({ message: 'Ticket updated' }));
  } catch (err) { next(err); }
});

export default router;
