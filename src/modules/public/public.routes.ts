/**
 * Public routes — no authentication required.
 * Used by the Customer App (QR ordering).
 *
 * GET  /api/v1/public/menu/:slug          — full menu (restaurant + mall mode) with modifiers
 * POST /api/v1/public/order/:slug         — place a guest order (with modifier selections)
 * GET  /api/v1/public/tables/:slug        — list active tables (for restaurant mode)
 */

import crypto from 'crypto';
import { Router, Request, Response, NextFunction } from 'express';
import { query } from '@/config/database';
import { ordersRepository } from '@/modules/orders/orders.repository';
import { restaurantsRepository } from '@/modules/restaurants/restaurants.repository';
import { menuRepository } from '@/modules/menu/menu.repository';
import { successResponse } from '@/shared/utils/responseHandler';
import { NotFoundError, BadRequestError } from '@/shared/errors/AppError';
import { eventBroadcaster } from '@/shared/socket/eventBroadcaster';
import { publicOrderRateLimiter } from '@/shared/middleware/rateLimiter';
import { env } from '@/config/env';
import { createRazorpayOrder } from '@/modules/payments/gateways/razorpay.gateway';
import { modifierRepository } from '@/modules/modifiers/modifier.repository';
import { z } from 'zod';

const router = Router();

// ─── helpers ────────────────────────────────────────────────────────────────

async function getRestaurantBySlug(slug: string) {
  const result = await query(
    `SELECT id, name, slug, qr_mode, qsr_enabled, token_prefix, token_daily_reset FROM restaurants WHERE slug = $1 LIMIT 1`,
    [slug],
  );
  return result.rows[0] || null;
}

// ─── GET /api/v1/public/menu/:slug ──────────────────────────────────────────

router.get('/menu/:slug', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const restaurant = await getRestaurantBySlug(req.params.slug);
    if (!restaurant) throw new NotFoundError('Restaurant not found');

    const [categories, items] = await Promise.all([
      menuRepository.findCategoriesByRestaurantId(restaurant.id),
      menuRepository.findMenuItemsByRestaurantId(restaurant.id),
    ]);

    const activeItems = items.filter((i) => i.is_active);

    // ── Attach modifier groups with options to each menu item ────────────
    const itemIds = activeItems.map((i) => i.id);
    const modifiersByItem: Record<string, any[]> = {};

    if (itemIds.length > 0) {
      const modifierRows = await query(
        `SELECT
           mimg.menu_item_id,
           mg.id                  AS group_id,
           mg.name                AS group_name,
           mg.selection_type,
           mg.min_select,
           mg.max_select,
           mg.sort_order          AS group_sort_order,
           mo.id                  AS option_id,
           mo.name                AS option_name,
           mo.price_adjustment,
           mo.sort_order          AS option_sort_order
         FROM menu_item_modifier_groups mimg
         INNER JOIN modifier_groups mg
           ON mg.id = mimg.modifier_group_id AND mg.is_active = TRUE
         LEFT JOIN modifier_options mo
           ON mo.modifier_group_id = mg.id AND mo.is_active = TRUE
         WHERE mimg.menu_item_id = ANY($1::uuid[])
         ORDER BY mimg.sort_order, mg.name, mo.sort_order, mo.name`,
        [itemIds],
      );

      const groupMap: Record<string, Record<string, any>> = {};
      for (const row of modifierRows.rows) {
        const iId = row.menu_item_id;
        const gId = row.group_id;
        if (!groupMap[iId]) groupMap[iId] = {};
        if (!groupMap[iId][gId]) {
          groupMap[iId][gId] = {
            id: row.group_id,
            name: row.group_name,
            selection_type: row.selection_type,
            min_select: row.min_select,
            max_select: row.max_select,
            sort_order: row.group_sort_order,
            options: [],
          };
        }
        if (row.option_id) {
          groupMap[iId][gId].options.push({
            id: row.option_id,
            name: row.option_name,
            price_adjustment: Number(row.price_adjustment),
            sort_order: row.option_sort_order,
          });
        }
      }

      for (const [itemId, groups] of Object.entries(groupMap)) {
        modifiersByItem[itemId] = Object.values(groups);
      }
    }

    const itemsWithModifiers = activeItems.map((item) => ({
      ...item,
      modifier_groups: modifiersByItem[item.id] || [],
    }));

    res.json(
      successResponse({
        restaurant: {
          id: restaurant.id,
          name: restaurant.name,
          slug: restaurant.slug,
          qr_mode: restaurant.qr_mode || 'restaurant',
        },
        categories: categories.filter((c) => c.is_active),
        items: itemsWithModifiers,
      }),
    );
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/v1/public/tables/:slug ────────────────────────────────────────
// Returns active tables so the customer can pick their table number.

router.get('/tables/:slug', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const restaurant = await getRestaurantBySlug(req.params.slug);
    if (!restaurant) throw new NotFoundError('Restaurant not found');

    const result = await query(
      `SELECT id, table_number, seats
       FROM restaurant_tables
       WHERE restaurant_id = $1 AND is_active = TRUE
       ORDER BY table_number ASC`,
      [restaurant.id],
    );

    res.json(successResponse(result.rows));
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/v1/public/order/:slug ────────────────────────────────────────
// Unified order endpoint for both restaurant and mall modes.
//
// Restaurant mode fields: table_id (optional), table_number (optional text)
// Mall mode fields:       customer_name (required), customer_phone (required),
//                         payment_method ('CASH'|'CARD'|'UPI'|'ONLINE')

// ── Modifier selection Zod schema ───────────────────────────────────────────

const ModifierSelectionSchema = z.object({
  modifier_group_id:   z.string().uuid(),
  modifier_group_name: z.string(),
  modifier_option_id:  z.string().uuid(),
  modifier_option_name: z.string(),
  price_adjustment:    z.number().default(0),
});

const GuestOrderSchema = z.object({
  // Restaurant mode
  table_id: z.string().uuid().optional().nullable(),
  table_number: z.string().max(50).optional().nullable(),

  // Mall mode
  customer_name: z.string().min(1).max(100).optional(),
  customer_phone: z.string().max(20).optional(),
  payment_method: z.enum(['CASH', 'CARD', 'UPI', 'ONLINE']).optional(),

  // Common
  notes: z.string().max(500).optional(),
  items: z
    .array(
      z.object({
        menu_item_id: z.string().uuid(),
        quantity: z.number().int().min(1),
        special_instructions: z.string().max(500).optional(),
        modifiers: z.array(ModifierSelectionSchema).optional().default([]),
      }),
    )
    .min(1, 'At least one item is required'),
});

router.post('/order/:slug', publicOrderRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const restaurant = await getRestaurantBySlug(req.params.slug);
    if (!restaurant) throw new NotFoundError('Restaurant not found');

    const payload = GuestOrderSchema.parse(req.body);
    const restaurantId: string = restaurant.id;
    const qrMode: string = restaurant.qr_mode || 'restaurant';

    // Mall mode validation
    if (qrMode === 'mall') {
      if (!payload.customer_name?.trim()) {
        throw new BadRequestError('Customer name is required');
      }
      if (!payload.customer_phone?.trim()) {
        throw new BadRequestError('Customer phone is required');
      }
    }

    // Validate + price each item (including modifier price adjustments)
    const orderItems: Array<{
      menu_item_id: string;
      quantity: number;
      unit_price: number;
      special_instructions: string | null;
      status: string;
      modifiers: Array<{
        modifier_group_id: string;
        modifier_group_name: string;
        modifier_option_id: string;
        modifier_option_name: string;
        price_adjustment: number;
      }>;
    }> = [];

    for (const item of payload.items) {
      const menuItem = await menuRepository.findMenuItemById(item.menu_item_id);
      if (!menuItem || menuItem.restaurant_id !== restaurantId || !menuItem.is_active) {
        throw new BadRequestError('Menu item not available');
      }

      // Calculate modifier price adjustments
      let modifierAdjustment = 0;
      const validatedModifiers: Array<{
        modifier_group_id: string;
        modifier_group_name: string;
        modifier_option_id: string;
        modifier_option_name: string;
        price_adjustment: number;
      }> = [];

      if (item.modifiers && item.modifiers.length > 0) {
        // Validate each modifier option exists and is active
        const optionIds = item.modifiers.map((m) => m.modifier_option_id);
        const optionRows = await query(
          `SELECT mo.id, mo.name, mo.price_adjustment, mo.modifier_group_id, mg.name AS group_name
           FROM modifier_options mo
           INNER JOIN modifier_groups mg ON mg.id = mo.modifier_group_id AND mg.is_active = TRUE
           WHERE mo.id = ANY($1::uuid[]) AND mo.is_active = TRUE`,
          [optionIds],
        );

        const validOptions: Record<string, { name: string; price_adjustment: number; groupId: string; groupName: string }> = {};
        for (const row of optionRows.rows) {
          validOptions[row.id] = {
            name: row.name,
            price_adjustment: Number(row.price_adjustment),
            groupId: row.modifier_group_id,
            groupName: row.group_name,
          };
        }

        for (const mod of item.modifiers) {
          const valid = validOptions[mod.modifier_option_id];
          if (!valid) {
            throw new BadRequestError(`Modifier option not available: ${mod.modifier_option_name}`);
          }
          modifierAdjustment += valid.price_adjustment;
          validatedModifiers.push({
            modifier_group_id: mod.modifier_group_id,
            modifier_group_name: valid.groupName,
            modifier_option_id: mod.modifier_option_id,
            modifier_option_name: valid.name,
            price_adjustment: valid.price_adjustment,
          });
        }
      }

      orderItems.push({
        menu_item_id: item.menu_item_id,
        quantity: item.quantity,
        unit_price: Number(menuItem.price) + modifierAdjustment,
        special_instructions: item.special_instructions ?? null,
        status: 'PENDING',
        modifiers: validatedModifiers,
      });
    }

    const totalAmount = orderItems.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);

    // Validate table_id belongs to this restaurant
    if (payload.table_id) {
      const tableCheck = await query(
        `SELECT id FROM restaurant_tables
         WHERE id = $1 AND restaurant_id = $2 AND is_active = TRUE
         LIMIT 1`,
        [payload.table_id, restaurantId],
      );
      if (tableCheck.rows.length === 0) {
        throw new BadRequestError('Table not found');
      }
    }

    const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
    const suffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const prefix = qrMode === 'mall' ? 'MALL' : 'QR';
    const orderNumber = `${prefix}-${restaurantId.slice(0, 8)}-${timestamp}-${suffix}`;

    // ── QSR token generation ────────────────────────────────────────────
    let tokenNumber: string | null = null;
    if (restaurant.qsr_enabled) {
      const counter = await restaurantsRepository.nextTokenNumber(restaurantId);
      const seq = String(counter).padStart(3, '0');
      tokenNumber = `${restaurant.token_prefix}-${seq}`;
    }

    // Build special instructions / notes
    const noteParts: string[] = [];
    if (payload.customer_name) noteParts.push(`Customer: ${payload.customer_name}`);
    if (payload.customer_phone) noteParts.push(`Phone: ${payload.customer_phone}`);
    if (payload.table_number) noteParts.push(`Table: ${payload.table_number}`);
    if (payload.payment_method) noteParts.push(`Payment: ${payload.payment_method}`);
    if (payload.notes) noteParts.push(payload.notes);

    const { order } = await ordersRepository.createOrderWithItems(
      restaurantId,
      payload.table_id ?? null,
      orderNumber,
      'ONLINE',
      'QR',
      totalAmount,
      10,
      noteParts.join(' | ') || null,
      null,
      orderItems.map((i) => ({
        menu_item_id: i.menu_item_id,
        quantity: i.quantity,
        unit_price: i.unit_price,
        special_instructions: i.special_instructions,
        status: i.status,
      })),
      'CREATED',
      tokenNumber,
    );

    // ── Save modifier selections for each order item ─────────────────────
    for (let idx = 0; idx < orderItems.length; idx++) {
      const oi = orderItems[idx];
      if (oi.modifiers.length > 0) {
        // We need the order_item IDs. The createOrderWithItems returns items in order.
        // We can query the items for this order to get their IDs.
      }
    }

    // Query order items to get their IDs for modifier attachment
    const orderItemRows = await query(
      `SELECT id, menu_item_id FROM order_items WHERE order_id = $1 ORDER BY created_at ASC`,
      [order.id],
    );

    for (const oiRow of orderItemRows.rows) {
      const matchingItem = orderItems.find((oi) => oi.menu_item_id === oiRow.menu_item_id);
      if (matchingItem && matchingItem.modifiers.length > 0) {
        for (const mod of matchingItem.modifiers) {
          await modifierRepository.createOrderItemModifier(
            oiRow.id,
            mod.modifier_group_id,
            mod.modifier_group_name,
            mod.modifier_option_id,
            mod.modifier_option_name,
            mod.price_adjustment,
          );
        }
      }
    }

    // If payment method is not CASH, create a pending payment record
    if (payload.payment_method && payload.payment_method !== 'CASH') {
      await query(
        `INSERT INTO payments (restaurant_id, order_id, amount, method, status)
         VALUES ($1, $2, $3, $4, 'PENDING')`,
        [restaurantId, order.id, totalAmount, payload.payment_method],
      );
    }

    // ── Razorpay: create payment order if gateway is active ──────────────
    let razorpayData: {
      razorpay_order_id: string;
      amount: number;
      currency: string;
      key_id: string;
    } | null = null;

    const isOnlinePayment =
      payload.payment_method &&
      payload.payment_method !== 'CASH' &&
      env.PAYMENT_GATEWAY === 'razorpay';

    if (isOnlinePayment) {
      try {
        razorpayData = await createRazorpayOrder(order.id, totalAmount);

        await query(
          `UPDATE payments
           SET reference_number = $1
           WHERE order_id = $2 AND status = 'PENDING'`,
          [razorpayData.razorpay_order_id, order.id],
        );
      } catch (err) {
        console.error('[Razorpay] Failed to create payment order:', err);
      }
    }

    // ── Broadcast to Kitchen Display via Socket.io ───────────────────────
    const shouldBroadcastNow =
      !isOnlinePayment || !razorpayData;

    if (shouldBroadcastNow) {
      eventBroadcaster?.broadcastOrderCreated({
        order_id: order.id,
        restaurant_id: restaurantId,
        status: order.status,
        total_amount: Number(order.total_amount),
        table_id: order.table_id,
      });
    }

    res.status(201).json(
      successResponse(
        {
          order_number:   order.order_number,
          order_id:       order.id,
          total_amount:   order.total_amount,
          status:         order.status,
          items_count:    orderItems.length,
          payment_method: payload.payment_method || 'CASH',
          qr_mode:        qrMode,
          razorpay:       razorpayData,
        },
        { message: 'Order placed successfully' },
      ),
    );
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/v1/public/verify-payment ─────────────────────────────────────
// Called by the frontend after Razorpay client-side checkout completes.

const VerifyPaymentSchema = z.object({
  order_id:            z.string().uuid(),
  razorpay_order_id:   z.string(),
  razorpay_payment_id: z.string(),
  razorpay_signature:  z.string(),
});

router.post('/verify-payment', publicOrderRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = VerifyPaymentSchema.parse(req.body);

    const { verifyPaymentSignature } = await import('@/modules/payments/gateways/razorpay.gateway');
    const isValid = verifyPaymentSignature(
      payload.razorpay_order_id,
      payload.razorpay_payment_id,
      payload.razorpay_signature,
    );

    if (!isValid) {
      throw new BadRequestError('Invalid payment signature');
    }

    const paymentResult = await query(
      `UPDATE payments
       SET status = 'PAID', reference_number = $1, updated_at = NOW()
       WHERE order_id = $2 AND status = 'PENDING'
       RETURNING id, restaurant_id, order_id, amount`,
      [payload.razorpay_payment_id, payload.order_id],
    );

    if (paymentResult.rows.length === 0) {
      res.json(successResponse({ verified: true, message: 'Payment already confirmed' }));
      return;
    }

    const payment = paymentResult.rows[0];

    const orderResult = await query(
      `UPDATE orders
       SET status = 'ACCEPTED', updated_at = NOW()
       WHERE id = $1 AND status = 'CREATED'
       RETURNING id, restaurant_id, table_id, total_amount, status`,
      [payload.order_id],
    );

    const order = orderResult.rows[0];

    if (order) {
      eventBroadcaster?.broadcastOrderCreated({
        order_id:      order.id,
        restaurant_id: order.restaurant_id,
        status:        order.status,
        total_amount:  Number(order.total_amount),
        table_id:      order.table_id,
      });
      eventBroadcaster?.broadcastPaymentCompleted({
        payment_id:    payment.id,
        restaurant_id: payment.restaurant_id,
        order_id:      payment.order_id,
        status:        'PAID',
        amount:        Number(payment.amount),
      });
    }

    res.json(successResponse({ verified: true, message: 'Payment confirmed' }));
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/v1/public/tokens/:restaurantId ─────────────────────────────────
// Public endpoint for the token display board (no auth required).

router.get('/tokens/:restaurantId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { restaurantId } = req.params;
    const result = await query(
      `SELECT id, order_number, token_number, status, created_at
       FROM orders
       WHERE restaurant_id = $1
         AND token_number IS NOT NULL
         AND status IN ('ACCEPTED', 'PREPARING', 'READY')
         AND DATE(created_at) = CURRENT_DATE
       ORDER BY
         CASE status WHEN 'READY' THEN 0 WHEN 'PREPARING' THEN 1 ELSE 2 END,
         token_number ASC
       LIMIT 100`,
      [restaurantId],
    );
    res.json(successResponse(result.rows));
  } catch (err) {
    next(err);
  }
});

export default router;