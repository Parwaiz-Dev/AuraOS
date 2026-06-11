import { restaurantsRepository } from './restaurants.repository';
import {
  Restaurant,
  RestaurantStats,
  CreateRestaurantRequest,
  UpdateRestaurantRequest,
} from './restaurants.types';
import { ConflictError, NotFoundError, BadRequestError } from '@/shared/errors/AppError';

export class RestaurantsService {
  /**
   * Generate a URL-safe slug from restaurant name
   */
  generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  }

  /**
   * Validate and ensure unique slug
   */
  async validateSlug(slug: string, excludeId?: string): Promise<string> {
    if (!slug || slug.length < 2) {
      throw new BadRequestError('Slug must be at least 2 characters long');
    }

    if (!/^[a-z0-9-]+$/.test(slug)) {
      throw new BadRequestError('Slug can only contain lowercase letters, numbers, and hyphens');
    }

    if (slug.startsWith('-') || slug.endsWith('-')) {
      throw new BadRequestError('Slug cannot start or end with a hyphen');
    }

    const exists = await restaurantsRepository.slugExists(slug, excludeId);
    if (exists) {
      throw new ConflictError('Restaurant slug already exists');
    }

    return slug;
  }

  /**
   * Create a new restaurant
   */
  async createRestaurant(payload: CreateRestaurantRequest): Promise<Restaurant> {
    const { name, auto_approve_online_orders, delay_threshold_minutes } = payload;

    // Generate and validate slug
    let slug = this.generateSlug(name);
    let counter = 1;
    let originalSlug = slug;

    while (await restaurantsRepository.slugExists(slug)) {
      slug = `${originalSlug}-${counter}`;
      counter++;
      if (counter > 100) {
        throw new ConflictError('Unable to generate unique slug for restaurant name');
      }
    }

    // Validate the final slug
    await this.validateSlug(slug);

    return restaurantsRepository.create(
      name,
      slug,
      auto_approve_online_orders,
      delay_threshold_minutes
    );
  }

  /**
   * Get restaurant by ID
   */
  async getRestaurant(restaurantId: string): Promise<Restaurant> {
    const restaurant = await restaurantsRepository.findById(restaurantId);
    if (!restaurant) {
      throw new NotFoundError('Restaurant not found');
    }
    return restaurant;
  }

  /**
   * Get restaurant by slug
   */
  async getRestaurantBySlug(slug: string): Promise<Restaurant> {
    const restaurant = await restaurantsRepository.findBySlug(slug);
    if (!restaurant) {
      throw new NotFoundError('Restaurant not found');
    }
    return restaurant;
  }

  /**
   * Update restaurant
   */
  async updateRestaurant(restaurantId: string, payload: UpdateRestaurantRequest): Promise<Restaurant> {
    const { name, auto_approve_online_orders, delay_threshold_minutes } = payload;

    // Verify restaurant exists
    const existing = await this.getRestaurant(restaurantId);

    const updates: any = {};

    if (name !== undefined) {
      updates.name = name;

      // If name is changing, generate new slug
      const newSlug = this.generateSlug(name);
      if (newSlug !== existing.slug) {
        let slug = newSlug;
        let counter = 1;
        let originalSlug = slug;

        while (await restaurantsRepository.slugExists(slug, restaurantId)) {
          slug = `${originalSlug}-${counter}`;
          counter++;
          if (counter > 100) {
            throw new ConflictError('Unable to generate unique slug for updated restaurant name');
          }
        }

        await this.validateSlug(slug, restaurantId);
        updates.slug = slug;
      }
    }

    if (auto_approve_online_orders !== undefined) {
      updates.auto_approve_online_orders = auto_approve_online_orders;
    }

    if (delay_threshold_minutes !== undefined) {
      updates.delay_threshold_minutes = delay_threshold_minutes;
    }

    if (payload.restaurant_type !== undefined) { updates.restaurant_type = payload.restaurant_type; }
    if ((payload as any).qr_mode !== undefined) { (updates as any).qr_mode = (payload as any).qr_mode; }
    if (payload.features !== undefined) { updates.features = payload.features; }
    if ((payload as any).gstin !== undefined) { (updates as any).gstin = (payload as any).gstin; }
    if ((payload as any).tax_rate !== undefined) { (updates as any).tax_rate = (payload as any).tax_rate; }
    if ((payload as any).tax_inclusive !== undefined) { (updates as any).tax_inclusive = (payload as any).tax_inclusive; }
    if (payload.qsr_enabled !== undefined) { updates.qsr_enabled = payload.qsr_enabled; }
    if (payload.token_prefix !== undefined) { updates.token_prefix = payload.token_prefix; }
    if (payload.token_daily_reset !== undefined) { updates.token_daily_reset = payload.token_daily_reset; }

    const updated = await restaurantsRepository.update(restaurantId, updates);
    if (!updated) {
      throw new NotFoundError('Restaurant not found');
    }

    return updated;
  }

  /**
   * Delete restaurant
   */
  async deleteRestaurant(restaurantId: string): Promise<void> {
    // Verify restaurant exists
    await this.getRestaurant(restaurantId);

    const deleted = await restaurantsRepository.delete(restaurantId);
    if (!deleted) {
      throw new NotFoundError('Restaurant not found');
    }
  }

  /**
   * Get restaurant statistics
   */
  async getRestaurantStats(restaurantId: string): Promise<RestaurantStats> {
    // Verify restaurant exists
    await this.getRestaurant(restaurantId);

    return restaurantsRepository.getStats(restaurantId);
  }

  /**
   * Get all restaurants (admin operation)
   */
  async getAllRestaurants(limit: number = 50, offset: number = 0): Promise<Restaurant[]> {
    return restaurantsRepository.findAll(limit, offset);
  }

  async getRestaurantCount(): Promise<number> {
    return restaurantsRepository.count();
  }

  // ── Sections ────────────────────────────────────────────────────────────────

  async getSections(restaurantId: string) {
    return restaurantsRepository.findSectionsByRestaurantId(restaurantId);
  }

  async createSection(restaurantId: string, name: string, displayOrder: number = 0) {
    return restaurantsRepository.createSection(restaurantId, name.trim(), displayOrder);
  }

  async updateSection(sectionId: string, restaurantId: string, updates: Partial<{ name: string; display_order: number; is_active: boolean }>) {
    const updated = await restaurantsRepository.updateSection(sectionId, restaurantId, updates);
    if (!updated) throw new NotFoundError('Section not found');
    return updated;
  }

  async deleteSection(sectionId: string, restaurantId: string): Promise<void> {
    const deleted = await restaurantsRepository.deleteSection(sectionId, restaurantId);
    if (!deleted) throw new NotFoundError('Section not found');
  }

  async assignCategoryToSection(categoryId: string, sectionId: string | null, restaurantId: string): Promise<void> {
    await restaurantsRepository.assignCategoryToSection(categoryId, sectionId, restaurantId);
  }
}

export const restaurantsService = new RestaurantsService();