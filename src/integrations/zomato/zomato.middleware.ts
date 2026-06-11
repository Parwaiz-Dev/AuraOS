/**
 * Zomato webhook security middleware.
 *
 * Two layers of authentication:
 *
 * 1. X-Restaurant-ID header — identifies which restaurant this order belongs to.
 *    Must be present on every webhook call. Zomato (or your proxy) must send it.
 *
 * 2. HMAC-SHA256 signature — Zomato signs the raw body with a shared secret.
 *    We verify X-Zomato-Signature against HMAC(ZOMATO_WEBHOOK_SECRET, rawBody).
 *
 *    If ZOMATO_WEBHOOK_SECRET is not set:
 *      - development: warning logged, signature check skipped
 *      - production:  request rejected with 403
 *
 * SETUP
 * ─────
 * Add to .env:
 *   ZOMATO_WEBHOOK_SECRET=<shared secret agreed with Zomato / your proxy>
 *
 * The restaurant sending the webhook must include:
 *   X-Restaurant-ID: <your internal restaurant UUID>
 *   X-Zomato-Signature: sha256=<hmac hex>
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { env } from '@/config/env';

/**
 * Capture raw body bytes before JSON parsing.
 * Required for HMAC verification — once express.json() runs, raw bytes are gone.
 */
export function captureRawBody(req: Request, res: Response, next: NextFunction): void {
  const chunks: Buffer[] = [];
  req.on('data', (chunk: Buffer) => chunks.push(chunk));
  req.on('end', () => {
    (req as any).rawBody = Buffer.concat(chunks);
    try {
      req.body = JSON.parse((req as any).rawBody.toString('utf8'));
    } catch {
      req.body = {};
    }
    next();
  });
  req.on('error', next);
}

/**
 * Verify the X-Zomato-Signature header.
 * Rejects the request with 403 if the signature is invalid or missing in production.
 */
export function verifyZomatoSignature(req: Request, res: Response, next: NextFunction): void {
  const secret = env.ZOMATO_WEBHOOK_SECRET;

  if (!secret) {
    if (env.NODE_ENV === 'production') {
      console.error('[Zomato] ZOMATO_WEBHOOK_SECRET not set — rejecting webhook in production');
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Webhook not configured' },
      });
      return;
    }
    console.warn('[Zomato] ⚠️  ZOMATO_WEBHOOK_SECRET not set — skipping signature check (dev mode)');
    next();
    return;
  }

  const signature = req.headers['x-zomato-signature'] as string | undefined;

  if (!signature) {
    console.warn('[Zomato] Missing X-Zomato-Signature header — rejecting request');
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Missing webhook signature' },
    });
    return;
  }

  const rawBody: Buffer = (req as any).rawBody;
  if (!rawBody) {
    console.error('[Zomato] rawBody not available — captureRawBody middleware not applied');
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Webhook misconfigured' },
    });
    return;
  }

  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  const sigBuf      = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);

  if (
    sigBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expectedBuf)
  ) {
    console.warn('[Zomato] Invalid signature — possible spoofed request');
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Invalid webhook signature' },
    });
    return;
  }

  next();
}

/**
 * Require X-Restaurant-ID header.
 * Attaches the validated restaurantId to req so the controller never reads it
 * from the untrusted request body.
 */
export function requireRestaurantId(req: Request, res: Response, next: NextFunction): void {
  const restaurantId = req.headers['x-restaurant-id'] as string | undefined;

  if (!restaurantId || !restaurantId.trim()) {
    res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'Missing X-Restaurant-ID header' },
    });
    return;
  }

  // Basic UUID format check — prevents obviously malformed values reaching the DB
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(restaurantId.trim())) {
    res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'X-Restaurant-ID must be a valid UUID' },
    });
    return;
  }

  (req as any).webhookRestaurantId = restaurantId.trim();
  next();
}
