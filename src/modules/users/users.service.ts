import bcryptjs from 'bcryptjs';
import { usersRepository } from './users.repository';
import { authRepository } from '@/modules/auth/auth.repository';
import { CreateUserRequest, UpdateUserRequest, ChangePasswordRequest, UserProfile } from './users.types';
import { BadRequestError, ConflictError, NotFoundError } from '@/shared/errors/AppError';

export class UsersService {
  async getUsers(restaurantId: string, limit = 50, offset = 0): Promise<UserProfile[]> {
    return usersRepository.findAll(restaurantId, limit, offset);
  }

  async getUser(userId: string, restaurantId: string): Promise<UserProfile> {
    const user = await usersRepository.findById(userId);
    if (!user || user.restaurant_id !== restaurantId) {
      throw new NotFoundError('User not found');
    }
    return user;
  }

  async createUser(restaurantId: string, payload: CreateUserRequest): Promise<UserProfile> {
    const exists = await usersRepository.emailExistsInRestaurant(payload.email, restaurantId);
    if (exists) throw new ConflictError('Email already registered in this restaurant');

    const salt = await bcryptjs.genSalt(10);
    const passwordHash = await bcryptjs.hash(payload.password, salt);
    return usersRepository.create(restaurantId, payload.email, passwordHash, payload.name, payload.role);
  }

  async updateUser(userId: string, restaurantId: string, payload: UpdateUserRequest): Promise<UserProfile> {
    const existing = await this.getUser(userId, restaurantId);

    if (payload.email && payload.email !== existing.email) {
      const emailTaken = await usersRepository.emailExistsInRestaurant(payload.email, restaurantId, userId);
      if (emailTaken) throw new ConflictError('Email already in use');
    }

    const updated = await usersRepository.update(userId, payload);
    if (!updated) throw new NotFoundError('User not found');

    // If the user is being disabled, revoke all their refresh tokens immediately.
    // Their current access token expires naturally within JWT_EXPIRES_IN (≤15m) —
    // no DB hit needed on every request, just block the next token rotation.
    if (payload.is_active === false) {
      await authRepository.revokeAllRefreshTokens(userId);
    }

    return updated;
  }

  async changePassword(userId: string, restaurantId: string, payload: ChangePasswordRequest): Promise<void> {
    await this.getUser(userId, restaurantId);
    const salt = await bcryptjs.genSalt(10);
    const passwordHash = await bcryptjs.hash(payload.newPassword, salt);
    const ok = await usersRepository.updatePassword(userId, passwordHash);
    if (!ok) throw new NotFoundError('User not found');
  }

  async deleteUser(userId: string, restaurantId: string, requestingUserId: string): Promise<void> {
    if (userId === requestingUserId) {
      throw new BadRequestError('You cannot delete your own account');
    }
    await this.getUser(userId, restaurantId);

    // Revoke tokens before deleting the user row (FK cascade would delete them
    // anyway, but this is explicit and works even if cascade is removed later).
    await authRepository.revokeAllRefreshTokens(userId);

    const deleted = await usersRepository.delete(userId);
    if (!deleted) throw new NotFoundError('User not found');
  }
}

export const usersService = new UsersService();
