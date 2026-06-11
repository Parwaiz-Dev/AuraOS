import { Router } from 'express';
import { zomatoController } from './zomato.controller';
import { authenticate } from '@/shared/middleware/authenticate';
import { authorize } from '@/shared/middleware/authorize';
import {
  captureRawBody,
  verifyZomatoSignature,
  requireRestaurantId,
} from './zomato.middleware';

const router = Router();

// ── Webhook ───────────────────────────────────────────────────────────────────
// Middleware chain (order matters):
//   1. captureRawBody      — reads raw bytes before JSON parsing (needed for HMAC)
//   2. verifyZomatoSignature — verifies X-Zomato-Signature header
//   3. requireRestaurantId — validates X-Restaurant-ID header, attaches to req
//   4. zomatoController.webhook — processes the order
router.post(
  '/webhook',
  captureRawBody,
  verifyZomatoSignature,
  requireRestaurantId,
  (req, res, next) => zomatoController.webhook(req, res, next),
);

// ── Sync status ───────────────────────────────────────────────────────────────
router.get('/sync-status', authenticate, (req, res, next) => zomatoController.getSyncStatus(req, res, next));

// ── Item mappings (admin only) ────────────────────────────────────────────────
// GET    /integrations/zomato/mappings        — list all mappings
// POST   /integrations/zomato/mappings        — create or update a mapping (upsert)
// DELETE /integrations/zomato/mappings/:id    — delete a mapping
router.get('/mappings',     authenticate, authorize('ADMIN'), (req, res, next) => zomatoController.getMappings(req, res, next));
router.post('/mappings',    authenticate, authorize('ADMIN'), (req, res, next) => zomatoController.upsertMapping(req, res, next));
router.delete('/mappings/:id', authenticate, authorize('ADMIN'), (req, res, next) => zomatoController.deleteMapping(req, res, next));

export default router;
