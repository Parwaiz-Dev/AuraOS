import { Router } from 'express';
import { reportsController } from './reports.controller';
import { authenticate } from '@/shared/middleware/authenticate';
import { authorize } from '@/shared/middleware/authorize';

const router = Router();

router.get('/dashboard', authenticate, authorize('ADMIN'), (req, res, next) => reportsController.getDashboard(req, res, next));
router.get('/top-items', authenticate, authorize('ADMIN'), (req, res, next) => reportsController.getTopItems(req, res, next));
router.get('/daily-revenue', authenticate, authorize('ADMIN'), (req, res, next) => reportsController.getDailyRevenue(req, res, next));
router.get('/inventory-alerts', authenticate, authorize('ADMIN'), (req, res, next) => reportsController.getInventoryAlerts(req, res, next));

export default router;
