/**
 * WhatsApp webhook security middleware.
 *
 * Meta sends two types of requests to your webhook:
 *
 * 1. GET — initial verification when you register the webhook in Meta dashboard.
 *    Meta sends hub.verify_token and hub.challenge. You must echo back hub.challenge
 *    if the verify token matches.
 *
 * 2. POST — actual messages/events. Meta signs the raw body with your App Secret
 *    using HMAC-SHA256 and sends the signature in X-Hub-Signature-256 header.
 *    You must verify this signature before processing the payload.
 *
 * SETUP
 * ─────
 * Add to .env:
 *   WHATSAPP_VERIFY_TOKEN=any_random_string_you_choose (set same in Meta dashboard)
 *   WHATSAPP_APP_SECRET=your_meta_app_secret (from Meta App → Settings → Basic)
 *
 * Note: WHATSAPP_APP_SECRET is different from WHATSAPP_ACCESS_TOKEN.
 * App Secret is used for webhook signature verification.
 * Access Token is used for sending messages.
 *
 * IMPORTANT: This middleware must be registered BEFORE express.json() for the
 * /integrations/whatsapp/webhook route, because we need the raw body bytes
 * to compute the HMAC. Once express.json() parses the body, the raw bytes
 * are gone and the signature check will fail.
 *
 * See app.ts for how this is applied.
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { env } from '@/config/env';

/**
 * Capture raw body bytes before JSON parsing.
 * Attaches rawBody to the request object for signature verification.
 *
 * Usage: apply this middleware BEFORE express.json() on the webhook route.
 */
export function captureRawBody(req: Request, res: Response, next: NextFunction): void {
  const chunks: Buffer[] = [];

  req.on('data', (chunk: Buffer) => chunks.push(chunk));
  req.on('end', () => {
    (req as any).rawBody = Buffer.concat(chunks);

    // Manually parse JSON so the rest of the app still gets req.body
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
 * Verify Meta's X-Hub-Signature-256 header.
 *
 * If WHATSAPP_APP_SECRET is not configured, logs a warning and allows
 * the request through (so development works without credentials).
 * In production, always set WHATSAPP_APP_SECRET.
 */
export function verifyWhatsAppSignature(req: Request, res: Response, next: NextFunction): void {
  const appSecret = env.WHATSAPP_APP_SECRET;

  // If no secret configured, warn and pass through (dev mode)
  if (!appSecret) {
    if (env.NODE_ENV === 'production') {
      console.error('[WhatsApp] WHATSAPP_APP_SECRET not set — rejecting webhook in production');
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Webhook not configured' },
      });
      return;
    }
    console.warn('[WhatsApp] ⚠️  WHATSAPP_APP_SECRET not set — skipping signature check (dev mode)');
    next();
    return;
  }

  const signature = req.headers['x-hub-signature-256'] as string;

  if (!signature) {
    console.warn('[WhatsApp] Missing X-Hub-Signature-256 header — rejecting request');
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Missing webhook signature' },
    });
    return;
  }

  const rawBody: Buffer = (req as any).rawBody;
  if (!rawBody) {
    console.error('[WhatsApp] rawBody not available — captureRawBody middleware not applied');
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Webhook misconfigured' },
    });
    return;
  }

  // Compute expected signature
  const expectedSignature =
    'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');

  // Constant-time comparison to prevent timing attacks
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    sigBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
  ) {
    console.warn('[WhatsApp] Invalid signature — possible spoofed request');
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Invalid webhook signature' },
    });
    return;
  }

  next();
}

/**
 * Handle Meta's GET verification challenge.
 * Called when you first register or update the webhook URL in Meta dashboard.
 *
 * Meta sends:
 *   ?hub.mode=subscribe
 *   &hub.verify_token=<your_verify_token>
 *   &hub.challenge=<random_number>
 *
 * You must respond with hub.challenge if the verify_token matches.
 */
export function handleVerificationChallenge(req: Request, res: Response, next: NextFunction): void {
  const mode      = req.query['hub.mode'] as string;
  const token     = req.query['hub.verify_token'] as string;
  const challenge = req.query['hub.challenge'] as string;

  if (mode === 'subscribe') {
    const verifyToken = env.WHATSAPP_VERIFY_TOKEN;

    if (!verifyToken) {
      console.error('[WhatsApp] WHATSAPP_VERIFY_TOKEN not set');
      res.status(403).send('Verify token not configured');
      return;
    }

    if (token === verifyToken) {
      console.log('[WhatsApp] Webhook verified by Meta ✅');
      res.status(200).send(challenge);
      return;
    }

    console.warn('[WhatsApp] Verification failed — token mismatch');
    res.status(403).send('Verification failed');
    return;
  }

  // Not a verification request — pass to next handler
  next();
}
