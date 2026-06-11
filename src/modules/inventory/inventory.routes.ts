import { Router } from 'express';
import { inventoryController } from './inventory.controller';
import { authenticate } from '@/shared/middleware/authenticate';
import { authorize } from '@/shared/middleware/authorize';
import { checkSubscription } from '@/shared/middleware/checkSubscription';

const router = Router();

router.get('/stats', authenticate, authorize('ADMIN'), (req, res, next) => inventoryController.getStats(req, res, next));
router.get('/history', authenticate, authorize('ADMIN'), (req, res, next) => inventoryController.getRestaurantHistory(req, res, next));
router.get('/', authenticate, (req, res, next) => inventoryController.list(req, res, next));
router.post('/', authenticate, authorize('ADMIN'), checkSubscription, (req, res, next) => inventoryController.create(req, res, next));
router.get('/:id/history', authenticate, authorize('ADMIN'), (req, res, next) => inventoryController.getItemHistory(req, res, next));
router.get('/:id', authenticate, (req, res, next) => inventoryController.getById(req, res, next));
// Accept both PUT and PATCH
router.put('/:id', authenticate, authorize('ADMIN'), checkSubscription, (req, res, next) => inventoryController.update(req, res, next));
router.patch('/:id', authenticate, authorize('ADMIN'), checkSubscription, (req, res, next) => inventoryController.update(req, res, next));
router.delete('/:id', authenticate, authorize('ADMIN'), checkSubscription, (req, res, next) => inventoryController.delete(req, res, next));

export default router;
