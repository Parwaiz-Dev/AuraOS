import { Request, Response, NextFunction } from 'express';
import { restaurantsService } from './restaurants.service';
import {
  CreateRestaurantRequest,
  UpdateRestaurantRequest,
  CreateRestaurantRequestSchema,
  UpdateRestaurantRequestSchema,
} from './restaurants.types';
import { successResponse } from '@/shared/utils/responseHandler';
import { AuthenticatedRequest } from '@/shared/middleware/authenticate';

export class RestaurantsController {
  /**
   * POST /api/v1/restaurants
   * Create a new restaurant (Admin only)
   */
  async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = CreateRestaurantRequestSchema.parse(req.body) as CreateRestaurantRequest;
      const restaurant = await restaurantsService.createRestaurant(payload);
      res.status(201).json(
        successResponse(restaurant, {
          message: 'Restaurant created successfully',
        })
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/restaurants/me
   * Get current user's restaurant profile
   */
  async getProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) {
        throw new Error('User not associated with a restaurant');
      }

      const restaurant = await restaurantsService.getRestaurant(restaurantId);
      res.status(200).json(successResponse(restaurant));
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/restaurants/me
   * Update current restaurant settings (Admin only)
   */
  async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) {
        throw new Error('User not associated with a restaurant');
      }

      const payload = UpdateRestaurantRequestSchema.parse(req.body) as UpdateRestaurantRequest;
      const restaurant = await restaurantsService.updateRestaurant(restaurantId, payload);
      res.status(200).json(
        successResponse(restaurant, {
          message: 'Restaurant updated successfully',
        })
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/restaurants/stats
   * Get restaurant statistics (Admin only)
   */
  async getStats(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) {
        throw new Error('User not associated with a restaurant');
      }

      const stats = await restaurantsService.getRestaurantStats(restaurantId);
      res.status(200).json(successResponse(stats));
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/restaurants/me
   * Delete restaurant (Super Admin only - dangerous operation)
   */
  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) {
        throw new Error('User not associated with a restaurant');
      }

      await restaurantsService.deleteRestaurant(restaurantId);
      res.status(200).json(
        successResponse({
          message: 'Restaurant deleted successfully',
        })
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/restaurants
   * Get all restaurants (Super Admin only)
   */
  async getAll(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const restaurants = await restaurantsService.getAllRestaurants(limit, offset);
      const total = await restaurantsService.getRestaurantCount();

      res.status(200).json(
        successResponse(restaurants, {
          pagination: {
            total,
            limit,
            offset,
            hasMore: offset + limit < total,
          },
        })
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/restaurants/:slug
   * Get restaurant by slug (Public endpoint for restaurant discovery)
   */
  async getBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { slug } = req.params;
      const restaurant = await restaurantsService.getRestaurantBySlug(slug);
      res.status(200).json(successResponse(restaurant));
    } catch (error) {
      next(error);
    }
  }

  // ── Super-admin: update any restaurant's settings ─────────────────────────

  async superAdminUpdate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const payload = UpdateRestaurantRequestSchema.parse(req.body) as UpdateRestaurantRequest;
      const restaurant = await restaurantsService.updateRestaurant(id, payload);
      res.status(200).json(successResponse(restaurant, { message: 'Restaurant updated' }));
    } catch (error) {
      next(error);
    }
  }

  // ── Sections ──────────────────────────────────────────────────────────────

  async getSections(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) throw new Error('User not associated with a restaurant');
      const sections = await restaurantsService.getSections(restaurantId);
      res.status(200).json(successResponse(sections));
    } catch (error) {
      next(error);
    }
  }

  async createSection(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) throw new Error('User not associated with a restaurant');
      const { name, display_order } = req.body;
      if (!name?.trim()) {
        res.status(400).json({ success: false, error: { message: 'Section name is required' } });
        return;
      }
      const section = await restaurantsService.createSection(restaurantId, name, display_order ?? 0);
      res.status(201).json(successResponse(section, { message: 'Section created' }));
    } catch (error) {
      next(error);
    }
  }

  async updateSection(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) throw new Error('User not associated with a restaurant');
      const { id } = req.params;
      const section = await restaurantsService.updateSection(id, restaurantId, req.body);
      res.status(200).json(successResponse(section, { message: 'Section updated' }));
    } catch (error) {
      next(error);
    }
  }

  async deleteSection(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) throw new Error('User not associated with a restaurant');
      const { id } = req.params;
      await restaurantsService.deleteSection(id, restaurantId);
      res.status(200).json(successResponse({ message: 'Section deleted' }));
    } catch (error) {
      next(error);
    }
  }

  async assignCategorySection(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) throw new Error('User not associated with a restaurant');
      const { categoryId } = req.params;
      const { section_id } = req.body; // null = unassign
      await restaurantsService.assignCategoryToSection(categoryId, section_id ?? null, restaurantId);
      res.status(200).json(successResponse({ message: 'Category assigned to section' }));
    } catch (error) {
      next(error);
    }
  }
}

export const restaurantsController = new RestaurantsController();