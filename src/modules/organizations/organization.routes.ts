/**
 * Organization routes — super-admin multi-outlet management.
 *
 * Endpoints:
 *   POST   /api/v1/organizations/groups              — create organization group
 *   GET    /api/v1/organizations/groups               — list owner's groups
 *   GET    /api/v1/organizations/groups/:id            — get group with restaurants
 *   PUT    /api/v1/organizations/groups/:id            — update group name
 *   DELETE /api/v1/organizations/groups/:id            — delete group
 *   POST   /api/v1/organizations/groups/:id/restaurants — add restaurant to group
 *   DELETE /api/v1/organizations/groups/:id/restaurants/:restaurantId — remove
 *   GET    /api/v1/organizations/groups/:id/metrics    — aggregate metrics
 *   GET    /api/v1/organizations/restaurants           — list all restaurants (picker)
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, AuthenticatedRequest } from '@/shared/middleware/authenticate';
import { superAdmin } from '@/shared/middleware/superAdmin';
import { successResponse } from '@/shared/utils/responseHandler';
import { BadRequestError } from '@/shared/errors/AppError';
import { organizationService } from './organization.service';
import { authService } from '@/modules/auth/auth.service';
import { JWTPayload } from '@/modules/auth/auth.types';

const router = Router();

// ALL organization routes require super admin
router.use(authenticate, superAdmin);

// ── Groups ─────────────────────────────────────────────────────────────────────

// POST /api/v1/organizations/groups — create a new organization group
router.post('/groups', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const group = await organizationService.createGroup(req.body.name, req.user!.userId);
    res.status(201).json(successResponse(group, { message: 'Organization group created' }));
  } catch (err) { next(err); }
});

// GET /api/v1/organizations/groups — list all groups owned by this user
router.get('/groups', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const groups = await organizationService.getGroups(req.user!.userId);
    res.json(successResponse(groups));
  } catch (err) { next(err); }
});

// GET /api/v1/organizations/groups/:id — get group with restaurants
router.get('/groups/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const group = await organizationService.getGroupWithRestaurants(req.params.id, req.user!.userId);
    res.json(successResponse(group));
  } catch (err) { next(err); }
});

// PUT /api/v1/organizations/groups/:id — update group name
router.put('/groups/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const group = await organizationService.updateGroup(req.params.id, req.user!.userId, req.body);
    res.json(successResponse(group, { message: 'Group updated' }));
  } catch (err) { next(err); }
});

// DELETE /api/v1/organizations/groups/:id — delete group
router.delete('/groups/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await organizationService.deleteGroup(req.params.id, req.user!.userId);
    res.json(successResponse({ message: 'Organization group deleted' }));
  } catch (err) { next(err); }
});

// ── Restaurant assignment ──────────────────────────────────────────────────────

// POST /api/v1/organizations/groups/:id/restaurants — add restaurant to group
router.post('/groups/:id/restaurants', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await organizationService.addRestaurant(req.params.id, req.user!.userId, req.body.restaurant_id);
    res.status(201).json(successResponse({ message: 'Restaurant added to group' }));
  } catch (err) { next(err); }
});

// DELETE /api/v1/organizations/groups/:id/restaurants/:restaurantId — remove restaurant from group
router.delete('/groups/:id/restaurants/:restaurantId', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    await organizationService.removeRestaurant(req.params.id, req.user!.userId, req.params.restaurantId);
    res.json(successResponse({ message: 'Restaurant removed from group' }));
  } catch (err) { next(err); }
});

// ── Aggregate metrics ──────────────────────────────────────────────────────────

// GET /api/v1/organizations/groups/:id/metrics — get aggregate metrics
router.get('/groups/:id/metrics', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const metrics = await organizationService.getAggregateMetrics(req.params.id, req.user!.userId);
    res.json(successResponse(metrics));
  } catch (err) { next(err); }
});

// ── Restaurant picker ──────────────────────────────────────────────────────────

// GET /api/v1/organizations/restaurants — list all restaurants (for dropdown picking)
router.get('/restaurants', async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const restaurants = await organizationService.listAllRestaurants();
    res.json(successResponse(restaurants));
  } catch (err) { next(err); }
});

// ── Restaurant switcher ────────────────────────────────────────────────────────

// GET /api/v1/organizations/my-restaurants — list restaurants accessible to this super-admin
router.get('/my-restaurants', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const restaurants = await organizationService.getUserAccessibleRestaurants(req.user!.userId);
    res.json(successResponse(restaurants));
  } catch (err) { next(err); }
});

// POST /api/v1/organizations/switch-restaurant — switch active restaurant context
router.post('/switch-restaurant', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { restaurant_id } = req.body;
    if (!restaurant_id) throw new BadRequestError('restaurant_id is required');

    // Validate the user has access to this restaurant via an organization group
    const restaurants = await organizationService.getUserAccessibleRestaurants(req.user!.userId);
    const target = restaurants.find((r) => r.id === restaurant_id);
    if (!target) throw new BadRequestError('You do not have access to this restaurant');

    // Issue a new JWT with the target restaurant ID
    const payload: JWTPayload = {
      id: req.user!.userId,
      email: req.user!.email,
      role: req.user!.role,
      restaurantId: restaurant_id,
    };
    const token = authService.generateToken(payload);

    res.json(successResponse({ token, restaurant_id, restaurant_name: target.name }));
  } catch (err) { next(err); }
});

export default router;