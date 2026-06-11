import { Router } from 'express';
import { menuController } from './menu.controller';
import { authenticate } from '@/shared/middleware/authenticate';
import { authorize } from '@/shared/middleware/authorize';
import { checkSubscription } from '@/shared/middleware/checkSubscription';

const router = Router();

// Read-only menu overview for authenticated users
router.get('/', authenticate, (req, res, next) => menuController.getMenu(req, res, next));

// Menu stats (admin only)
router.get('/stats', authenticate, authorize('ADMIN'), (req, res, next) => menuController.getMenuStats(req, res, next));

// Category routes
router.get('/categories', authenticate, (req, res, next) => menuController.getCategories(req, res, next));
router.get('/categories/:id', authenticate, (req, res, next) => menuController.getCategory(req, res, next));
router.post('/categories', authenticate, authorize('ADMIN'), checkSubscription, (req, res, next) => menuController.createCategory(req, res, next));
router.put('/categories/:id', authenticate, authorize('ADMIN'), checkSubscription, (req, res, next) => menuController.updateCategory(req, res, next));
router.delete('/categories/:id', authenticate, authorize('ADMIN'), checkSubscription, (req, res, next) => menuController.deleteCategory(req, res, next));

// Menu item routes
router.get('/items', authenticate, (req, res, next) => menuController.getMenuItems(req, res, next));
router.get('/items/:id', authenticate, (req, res, next) => menuController.getMenuItem(req, res, next));
router.post('/items', authenticate, authorize('ADMIN'), checkSubscription, (req, res, next) => menuController.createMenuItem(req, res, next));
router.put('/items/:id', authenticate, authorize('ADMIN'), checkSubscription, (req, res, next) => menuController.updateMenuItem(req, res, next));
router.delete('/items/:id', authenticate, authorize('ADMIN'), checkSubscription, (req, res, next) => menuController.deleteMenuItem(req, res, next));

export default router;