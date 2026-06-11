import { Response, NextFunction } from 'express';
import { modifierService } from './modifier.service';
import {
  CreateModifierGroupRequest,
  UpdateModifierGroupRequest,
  CreateModifierOptionRequest,
  UpdateModifierOptionRequest,
  AttachModifierGroupsRequest,
  CreateModifierGroupRequestSchema,
  UpdateModifierGroupRequestSchema,
  CreateModifierOptionRequestSchema,
  UpdateModifierOptionRequestSchema,
  AttachModifierGroupsRequestSchema,
} from './modifier.types';
import { successResponse } from '@/shared/utils/responseHandler';
import { AuthenticatedRequest } from '@/shared/middleware/authenticate';

export class ModifierController {
  // ── Modifier Groups ────────────────────────────────────────────────────

  async createGroup(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) throw new Error('User not associated with a restaurant');

      const payload = CreateModifierGroupRequestSchema.parse(req.body) as CreateModifierGroupRequest;
      const group = await modifierService.createGroup(restaurantId, payload);
      res.status(201).json(
        successResponse(group, { message: 'Modifier group created successfully' }),
      );
    } catch (error) {
      next(error);
    }
  }

  async getGroups(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) throw new Error('User not associated with a restaurant');

      const groups = await modifierService.getGroups(restaurantId);
      res.status(200).json(successResponse(groups));
    } catch (error) {
      next(error);
    }
  }

  async getGroup(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) throw new Error('User not associated with a restaurant');

      const { id } = req.params;
      const group = await modifierService.getGroup(id);
      if (group.restaurant_id !== restaurantId) {
        throw new Error('Modifier group not found');
      }
      res.status(200).json(successResponse(group));
    } catch (error) {
      next(error);
    }
  }

  async updateGroup(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) throw new Error('User not associated with a restaurant');

      const { id } = req.params;
      const payload = UpdateModifierGroupRequestSchema.parse(req.body) as UpdateModifierGroupRequest;
      const group = await modifierService.updateGroup(id, restaurantId, payload);
      res.status(200).json(
        successResponse(group, { message: 'Modifier group updated successfully' }),
      );
    } catch (error) {
      next(error);
    }
  }

  async deleteGroup(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) throw new Error('User not associated with a restaurant');

      const { id } = req.params;
      await modifierService.deleteGroup(id, restaurantId);
      res.status(200).json(successResponse({ message: 'Modifier group deleted successfully' }));
    } catch (error) {
      next(error);
    }
  }

  // ── Modifier Options ────────────────────────────────────────────────────

  async createOption(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) throw new Error('User not associated with a restaurant');

      const { groupId } = req.params;
      const payload = CreateModifierOptionRequestSchema.parse(req.body) as CreateModifierOptionRequest;
      const option = await modifierService.createOption(groupId, restaurantId, payload);
      res.status(201).json(
        successResponse(option, { message: 'Modifier option created successfully' }),
      );
    } catch (error) {
      next(error);
    }
  }

  async getOptions(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) throw new Error('User not associated with a restaurant');

      const { groupId } = req.params;
      const options = await modifierService.getOptions(groupId, restaurantId);
      res.status(200).json(successResponse(options));
    } catch (error) {
      next(error);
    }
  }

  async updateOption(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) throw new Error('User not associated with a restaurant');

      const payload = UpdateModifierOptionRequestSchema.parse(req.body) as UpdateModifierOptionRequest;
      const option = await modifierService.updateOption(id, restaurantId, payload);
      res.status(200).json(
        successResponse(option, { message: 'Modifier option updated successfully' }),
      );
    } catch (error) {
      next(error);
    }
  }

  async deleteOption(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) throw new Error('User not associated with a restaurant');

      const { id } = req.params;
      await modifierService.deleteOption(id, restaurantId);
      res.status(200).json(successResponse({ message: 'Modifier option deleted successfully' }));
    } catch (error) {
      next(error);
    }
  }

  // ── Menu Item ↔ Modifier Group ─────────────────────────────────────────

  async attachGroups(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) throw new Error('User not associated with a restaurant');

      const { menuItemId } = req.params;
      const payload = AttachModifierGroupsRequestSchema.parse(req.body) as AttachModifierGroupsRequest;
      const groups = await modifierService.attachGroupsToMenuItem(menuItemId, payload.modifier_group_ids, restaurantId);
      res.status(200).json(
        successResponse(groups, { message: 'Modifier groups attached successfully' }),
      );
    } catch (error) {
      next(error);
    }
  }

  async detachGroup(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { menuItemId, modifierGroupId } = req.params;
      await modifierService.detachGroupFromMenuItem(menuItemId, modifierGroupId);
      res.status(200).json(successResponse({ message: 'Modifier group detached successfully' }));
    } catch (error) {
      next(error);
    }
  }

  async getGroupsForMenuItem(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { menuItemId } = req.params;
      const groups = await modifierService.getModifierGroupsForMenuItem(menuItemId);
      res.status(200).json(successResponse(groups));
    } catch (error) {
      next(error);
    }
  }
}

export const modifierController = new ModifierController();