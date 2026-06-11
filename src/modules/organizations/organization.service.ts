import {
  OrganizationGroup,
  OrganizationGroupWithRestaurants,
  AggregateMetrics,
  CreateOrganizationGroupSchema,
  AddRestaurantToGroupSchema,
  UpdateOrganizationGroupSchema,
} from './organization.types';
import { organizationRepository } from './organization.repository';
import { BadRequestError, NotFoundError, ForbiddenError } from '@/shared/errors/AppError';

export class OrganizationService {
  // ── Groups ───────────────────────────────────────────────────────────────────

  async createGroup(name: string, ownerUserId: string): Promise<OrganizationGroup> {
    const parsed = CreateOrganizationGroupSchema.parse({ name });
    return organizationRepository.createGroup(parsed.name, ownerUserId);
  }

  async getGroups(ownerUserId: string): Promise<OrganizationGroup[]> {
    return organizationRepository.findGroupsByOwner(ownerUserId);
  }

  async getGroupWithRestaurants(
    groupId: string,
    userId: string,
  ): Promise<OrganizationGroupWithRestaurants> {
    const isOwner = await organizationRepository.isGroupOwnedByUser(groupId, userId);
    if (!isOwner) throw new ForbiddenError('You do not own this organization group');

    const group = await organizationRepository.findGroupWithRestaurants(groupId);
    if (!group) throw new NotFoundError('Organization group not found');
    return group;
  }

  async updateGroup(
    groupId: string,
    userId: string,
    payload: { name?: string },
  ): Promise<OrganizationGroup> {
    const parsed = UpdateOrganizationGroupSchema.parse(payload);
    if (!parsed.name) throw new BadRequestError('Nothing to update');

    const isOwner = await organizationRepository.isGroupOwnedByUser(groupId, userId);
    if (!isOwner) throw new ForbiddenError('You do not own this organization group');

    const group = await organizationRepository.updateGroup(groupId, parsed.name);
    if (!group) throw new NotFoundError('Organization group not found');
    return group;
  }

  async deleteGroup(groupId: string, userId: string): Promise<void> {
    const isOwner = await organizationRepository.isGroupOwnedByUser(groupId, userId);
    if (!isOwner) throw new ForbiddenError('You do not own this organization group');

    const deleted = await organizationRepository.deleteGroup(groupId);
    if (!deleted) throw new NotFoundError('Organization group not found');
  }

  // ── Restaurant assignment ────────────────────────────────────────────────────

  async addRestaurant(
    groupId: string,
    userId: string,
    restaurantId: string,
  ): Promise<void> {
    const parsed = AddRestaurantToGroupSchema.parse({ restaurant_id: restaurantId });

    const isOwner = await organizationRepository.isGroupOwnedByUser(groupId, userId);
    if (!isOwner) throw new ForbiddenError('You do not own this organization group');

    const alreadyInGroup = await organizationRepository.isRestaurantInGroup(
      groupId,
      parsed.restaurant_id,
    );
    if (alreadyInGroup) throw new BadRequestError('Restaurant already in this group');

    await organizationRepository.addRestaurantToGroup(groupId, parsed.restaurant_id);
  }

  async removeRestaurant(
    groupId: string,
    userId: string,
    restaurantId: string,
  ): Promise<void> {
    const isOwner = await organizationRepository.isGroupOwnedByUser(groupId, userId);
    if (!isOwner) throw new ForbiddenError('You do not own this organization group');

    await organizationRepository.removeRestaurantFromGroup(groupId, restaurantId);
  }

  // ── Aggregate metrics ──────────────────────────────────────────────────────

  async getAggregateMetrics(
    groupId: string,
    userId: string,
  ): Promise<AggregateMetrics> {
    const isOwner = await organizationRepository.isGroupOwnedByUser(groupId, userId);
    if (!isOwner) throw new ForbiddenError('You do not own this organization group');

    return organizationRepository.getAggregateMetrics(groupId);
  }

  // ── All restaurants (for dropdown) ─────────────────────────────────────────
  
  async listAllRestaurants(): Promise<{ id: string; name: string; slug: string; restaurant_type: string }[]> {
    return organizationRepository.findAllRestaurants();
  }

  // ── User-accessible restaurants (for restaurant switcher) ──────────────────

  /**
   * Returns only restaurants that belong to organization groups owned by this user.
   * Used by the restaurant switcher — a super-admin can only switch into restaurants
   * they explicitly manage.
   */
  async getUserAccessibleRestaurants(
    userId: string,
  ): Promise<{ id: string; name: string; slug: string; restaurant_type: string }[]> {
    return organizationRepository.findUserAccessibleRestaurants(userId);
  }
}

export const organizationService = new OrganizationService();