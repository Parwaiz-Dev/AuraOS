import { Router } from 'express';
import { restaurantsController } from './restaurants.controller';
import { authenticate } from '@/shared/middleware/authenticate';
import { authorize } from '@/shared/middleware/authorize';
import { superAdmin } from '@/shared/middleware/superAdmin';
import { checkSubscription } from '@/shared/middleware/checkSubscription';

const router = Router();

/**
 * Protected routes (authentication required)
 */

// Get current user's restaurant profile
router.get('/me', authenticate, (req, res, next) => restaurantsController.getProfile(req, res, next));

// Update current restaurant settings (Admin only)
router.put('/me', authenticate, authorize('ADMIN'), checkSubscription, (req, res, next) => restaurantsController.update(req, res, next));

// Get restaurant statistics (Admin only)
router.get('/me/stats', authenticate, authorize('ADMIN'), (req, res, next) => restaurantsController.getStats(req, res, next));

// Delete restaurant (Super Admin only - dangerous operation)
router.delete('/me', authenticate, authorize('ADMIN'), (req, res, next) => restaurantsController.delete(req, res, next));

/**
 * Public routes (no authentication required)
 */

// Get restaurant by slug (for public restaurant discovery)
router.get('/:slug', (req, res, next) => restaurantsController.getBySlug(req, res, next));

/**
 * Platform routes (Super Admin only — cross-tenant)
 *
 * These operate across ALL restaurants, so they are gated by the superAdmin
 * email allowlist (SUPER_ADMIN_EMAILS), NOT by the per-restaurant ADMIN role.
 * With an empty allowlist (default) these are closed to everyone.
 *
 * Note: normal restaurant signup goes through POST /api/v1/onboarding/register,
 * so POST / here is reserved for platform-owner provisioning only.
 */

// ── Sections (counters/stations for token slip printing) ─────────────────────
router.get('/me/sections', authenticate, (req, res, next) => restaurantsController.getSections(req, res, next));
router.post('/me/sections', authenticate, authorize('ADMIN'), checkSubscription, (req, res, next) => restaurantsController.createSection(req, res, next));
router.put('/me/sections/:id', authenticate, authorize('ADMIN'), checkSubscription, (req, res, next) => restaurantsController.updateSection(req, res, next));
router.delete('/me/sections/:id', authenticate, authorize('ADMIN'), (req, res, next) => restaurantsController.deleteSection(req, res, next));
// Assign a menu category to a section
router.patch('/me/categories/:categoryId/section', authenticate, authorize('ADMIN'), (req, res, next) => restaurantsController.assignCategorySection(req, res, next));

// Create new restaurant (platform owner only)
router.post('/', authenticate, superAdmin, (req, res, next) => restaurantsController.create(req, res, next));

// Get all restaurants across the platform (platform owner only)
router.get('/', authenticate, superAdmin, (req, res, next) => restaurantsController.getAll(req, res, next));

// Super-admin: update any restaurant's settings (type, features, QSR config)
router.put('/:id/settings', authenticate, superAdmin, (req, res, next) => restaurantsController.superAdminUpdate(req, res, next));

export default router;