import { Router } from 'express';
import { ordersController } from './orders.controller';
import { authenticate } from '@/shared/middleware/authenticate';
import { authorize } from '@/shared/middleware/authorize';
import { checkSubscription } from '@/shared/middleware/checkSubscription';

const router = Router();

router.post('/', authenticate, checkSubscription, (req, res, next) => ordersController.create(req, res, next));
router.get('/', authenticate, (req, res, next) => ordersController.list(req, res, next));
router.get('/stats', authenticate, authorize('ADMIN'), (req, res, next) => ordersController.getStats(req, res, next));
// Active order lookup for a table (for "add to existing order" flow)
router.get('/active/by-table/:tableId', authenticate, (req, res, next) => ordersController.getActiveByTable(req, res, next));
router.get('/:id', authenticate, (req, res, next) => ordersController.getById(req, res, next));
// Append items to an existing open order (running tab)
router.post('/:id/items', authenticate, checkSubscription, (req, res, next) => ordersController.addItems(req, res, next));
// Update a single item's status (PENDING → PREPARING → DONE) — kitchen use
router.patch('/:id/items/:itemId', authenticate, checkSubscription, authorize('KITCHEN', 'ADMIN'), (req, res, next) => ordersController.updateItemStatus(req, res, next));
// Accept both PUT and PATCH for status updates (frontend compatibility)
router.put('/:id', authenticate, checkSubscription, authorize('KITCHEN', 'ADMIN', 'WAITER', 'RECEPTION'), (req, res, next) => ordersController.update(req, res, next));
router.patch('/:id', authenticate, checkSubscription, authorize('KITCHEN', 'ADMIN', 'WAITER', 'RECEPTION'), (req, res, next) => ordersController.update(req, res, next));
router.delete('/:id', authenticate, checkSubscription, authorize('ADMIN'), (req, res, next) => ordersController.delete(req, res, next));

export default router;