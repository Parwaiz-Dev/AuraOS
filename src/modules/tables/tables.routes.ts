import { Router } from 'express';
import { tablesController } from './tables.controller';
import { authenticate } from '@/shared/middleware/authenticate';
import { authorize } from '@/shared/middleware/authorize';
import { checkSubscription } from '@/shared/middleware/checkSubscription';

const router = Router();

/**
 * Protected routes (authentication required)
 */

// Get all tables for current restaurant
router.get('/', authenticate, (req, res, next) => tablesController.getAll(req, res, next));

// Get all tables WITH active-order status (occupancy command-center view)
// NOTE: must be declared before '/:id' so 'with-status' isn't treated as an id
router.get('/with-status', authenticate, (req, res, next) => tablesController.getAllWithStatus(req, res, next));

// Get table statistics (Admin only)
router.get('/stats', authenticate, authorize('ADMIN'), (req, res, next) => tablesController.getStats(req, res, next));

// Get specific table by ID
router.get('/:id', authenticate, (req, res, next) => tablesController.getById(req, res, next));

// Create new table (Admin only)
router.post('/', authenticate, authorize('ADMIN'), checkSubscription, (req, res, next) => tablesController.create(req, res, next));

// Update table (Admin only) - accept both PUT and PATCH
router.put('/:id', authenticate, authorize('ADMIN'), checkSubscription, (req, res, next) => tablesController.update(req, res, next));
router.patch('/:id', authenticate, authorize('ADMIN'), checkSubscription, (req, res, next) => tablesController.update(req, res, next));

// Delete table (Admin only - dangerous operation)
router.delete('/:id', authenticate, authorize('ADMIN'), checkSubscription, (req, res, next) => tablesController.delete(req, res, next));

export default router;