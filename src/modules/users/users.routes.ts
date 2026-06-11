import { Router } from 'express';
import { usersController } from './users.controller';
import { authenticate } from '@/shared/middleware/authenticate';
import { authorize } from '@/shared/middleware/authorize';
import { checkSubscription } from '@/shared/middleware/checkSubscription';

const router = Router();

// All user management is ADMIN only
router.get('/', authenticate, authorize('ADMIN'), (req, res, next) => usersController.list(req, res, next));
router.get('/:id', authenticate, authorize('ADMIN'), (req, res, next) => usersController.getById(req, res, next));
router.post('/', authenticate, authorize('ADMIN'), checkSubscription, (req, res, next) => usersController.create(req, res, next));
router.put('/:id', authenticate, authorize('ADMIN'), checkSubscription, (req, res, next) => usersController.update(req, res, next));
router.patch('/:id', authenticate, authorize('ADMIN'), checkSubscription, (req, res, next) => usersController.update(req, res, next));
router.patch('/:id/password', authenticate, authorize('ADMIN'), checkSubscription, (req, res, next) => usersController.changePassword(req, res, next));
router.delete('/:id', authenticate, authorize('ADMIN'), checkSubscription, (req, res, next) => usersController.delete(req, res, next));

export default router;
