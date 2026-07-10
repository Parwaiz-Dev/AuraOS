import { Router } from 'express';
import { whatsappController } from './whatsapp.controller';
import { authenticate } from '@/shared/middleware/authenticate';
import {
  verifyWhatsAppSignature,
  handleVerificationChallenge,
} from './whatsapp.middleware';

const router = Router();

/**
 * GET /webhook — Meta verification challenge.
 * Called once when you register the webhook URL in Meta dashboard.
 * Responds with hub.challenge if hub.verify_token matches WHATSAPP_VERIFY_TOKEN.
 */
router.get('/webhook', handleVerificationChallenge);

/**
 * POST /webhook — Incoming WhatsApp messages.
 *
 * Middleware chain (order matters):
 *   1. verifyWhatsAppSignature — verifies X-Hub-Signature-256 over req.rawBody
 *   2. whatsappController.webhook — processes the message
 *
 * The raw body is captured globally by the express.json({ verify }) hook in
 * app.ts, so req.rawBody is already available here for HMAC verification.
 */
router.post(
  '/webhook',
  verifyWhatsAppSignature,
  (req, res, next) => whatsappController.webhook(req, res, next),
);

/**
 * GET /sync-status — WhatsApp integration stats (authenticated).
 */
router.get('/sync-status', authenticate, (req, res, next) =>
  whatsappController.getSyncStatus(req, res, next),
);

export default router;
