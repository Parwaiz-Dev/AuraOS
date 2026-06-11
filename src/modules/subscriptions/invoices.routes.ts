import { Router } from 'express';
import { subscriptionsController } from './subscriptions.controller';
import { authenticate } from '@/shared/middleware/authenticate';
import { authorize } from '@/shared/middleware/authorize';

const router = Router();

// List current restaurant's invoices (any authenticated user can view)
router.get('/', authenticate, (req, res, next) =>
  subscriptionsController.getInvoices(req, res, next),
);

// Create an invoice for own restaurant (ADMIN)
router.post('/', authenticate, authorize('ADMIN'), (req, res, next) =>
  subscriptionsController.createInvoice(req, res, next),
);

// Mark own restaurant's invoice as paid (ADMIN)
router.post('/:id/mark-paid', authenticate, authorize('ADMIN'), (req, res, next) =>
  subscriptionsController.markInvoicePaid(req, res, next),
);

export default router;
