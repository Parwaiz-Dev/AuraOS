import { Router } from 'express';
import { whatsappController } from './whatsapp.controller';
import { authenticate } from '@/shared/middleware/authenticate';
import {
  captureRawBody,
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
 *   1. captureRawBody   — reads raw bytes before JSON parsing (needed for HMAC)
 *   2. verifyWhatsAppSignature — verifies X-Hub-Signature-256 header
 *   3. whatsappController.webhook — processes the message
 *
 * Note: captureRawBody replaces express.json() for this route only.
 * It manually parses JSON after capturing raw bytes, so req.body is still available.
 */
router.post(
  '/webhook',
  captureRawBody,
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
