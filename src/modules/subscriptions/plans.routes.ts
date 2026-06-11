import { Router } from 'express';
import { subscriptionsController } from './subscriptions.controller';
import { authenticate } from '@/shared/middleware/authenticate';

const router = Router();

// List active subscription plans (any authenticated user)
router.get('/', authenticate, (req, res, next) =>
  subscriptionsController.getPlans(req, res, next),
);

export default router;
