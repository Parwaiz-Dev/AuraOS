import { Router } from 'express';
import { subscriptionsController } from './subscriptions.controller';
import { authenticate } from '@/shared/middleware/authenticate';
import { authorize } from '@/shared/middleware/authorize';
import { superAdmin } from '@/shared/middleware/superAdmin';

const router = Router();

// ── Super-admin (cross-tenant) — declare BEFORE param routes ────────────────
// Platform owner dashboard metrics
router.get('/platform-metrics', authenticate, superAdmin, (req, res, next) =>
  subscriptionsController.getPlatformMetrics(req, res, next),
);
// All restaurants with subscription status + search/filter
router.get('/all-restaurants', authenticate, superAdmin, (req, res, next) =>
  subscriptionsController.getAllRestaurants(req, res, next),
);
// Super-admin can mark any restaurant's invoice paid
router.post('/invoices/:id/mark-paid', authenticate, superAdmin, (req, res, next) =>
  subscriptionsController.adminMarkInvoicePaid(req, res, next),
);
// Suspend a restaurant
router.post('/admin/suspend/:restaurantId', authenticate, superAdmin, (req, res, next) =>
  subscriptionsController.adminSuspend(req, res, next),
);
// Activate a restaurant
router.post('/admin/activate/:restaurantId', authenticate, superAdmin, (req, res, next) =>
  subscriptionsController.adminActivate(req, res, next),
);
// Generate invoice for a restaurant
router.post('/admin/generate-invoice/:restaurantId', authenticate, superAdmin, (req, res, next) =>
  subscriptionsController.adminGenerateInvoice(req, res, next),
);

// ── Restaurant-scoped ───────────────────────────────────────────────────────
// Current restaurant's subscription (enriched view)
router.get('/me', authenticate, (req, res, next) =>
  subscriptionsController.getMySubscription(req, res, next),
);

// Change plan (ADMIN)
router.post('/change-plan', authenticate, authorize('ADMIN'), (req, res, next) =>
  subscriptionsController.changePlan(req, res, next),
);

export default router;
