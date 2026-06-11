import { Response, NextFunction } from 'express';
import { usersService } from './users.service';
import { CreateUserSchema, UpdateUserSchema, ChangePasswordSchema } from './users.types';
import { successResponse } from '@/shared/utils/responseHandler';
import { AuthenticatedRequest } from '@/shared/middleware/authenticate';

export class UsersController {
  async list(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user!.restaurantId;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = parseInt(req.query.offset as string) || 0;
      const users = await usersService.getUsers(restaurantId, limit, offset);
      res.status(200).json(successResponse(users));
    } catch (error) { next(error); }
  }

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await usersService.getUser(req.params.id, req.user!.restaurantId);
      res.status(200).json(successResponse(user));
    } catch (error) { next(error); }
  }

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = CreateUserSchema.parse(req.body);
      const user = await usersService.createUser(req.user!.restaurantId, payload);
      res.status(201).json(successResponse(user, { message: 'User created successfully' }));
    } catch (error) { next(error); }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = UpdateUserSchema.parse(req.body);
      const user = await usersService.updateUser(req.params.id, req.user!.restaurantId, payload);
      res.status(200).json(successResponse(user, { message: 'User updated successfully' }));
    } catch (error) { next(error); }
  }

  async changePassword(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = ChangePasswordSchema.parse(req.body);
      await usersService.changePassword(req.params.id, req.user!.restaurantId, payload);
      res.status(200).json(successResponse({ message: 'Password changed successfully' }));
    } catch (error) { next(error); }
  }

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await usersService.deleteUser(req.params.id, req.user!.restaurantId, req.user!.userId);
      res.status(200).json(successResponse({ message: 'User deleted successfully' }));
    } catch (error) { next(error); }
  }
}

export const usersController = new UsersController();
