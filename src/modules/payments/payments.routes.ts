import { Router } from 'express';
import { paymentsController } from './payments.controller';
import { authenticate } from '@/shared/middleware/authenticate';
import { authorize } from '@/shared/middleware/authorize';
import { checkSubscription } from '@/shared/middleware/checkSubscription';

const router = Router();

router.post('/', authenticate, checkSubscription, (req, res, next) => paymentsController.create(req, res, next));
router.get('/', authenticate, (req, res, next) => paymentsController.list(req, res, next));
router.get('/stats', authenticate, authorize('ADMIN'), (req, res, next) => paymentsController.getStats(req, res, next));
router.get('/:id', authenticate, (req, res, next) => paymentsController.getById(req, res, next));
router.put('/:id', authenticate, authorize('ADMIN'), checkSubscription, (req, res, next) => paymentsController.update(req, res, next));
router.patch('/:id', authenticate, authorize('ADMIN'), checkSubscription, (req, res, next) => paymentsController.update(req, res, next));
router.delete('/:id', authenticate, authorize('ADMIN'), checkSubscription, (req, res, next) => paymentsController.delete(req, res, next));

export default router;
