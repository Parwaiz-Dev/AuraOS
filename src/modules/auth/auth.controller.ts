import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import {
  LoginRequest,
  RegisterRequest,
  RefreshTokenRequest,
  LoginRequestSchema,
  RegisterRequestSchema,
  RefreshTokenRequestSchema,
} from './auth.types';
import { successResponse } from '@/shared/utils/responseHandler';
import { AuthenticatedRequest } from '@/shared/middleware/authenticate';
import { z } from 'zod';

const RequestResetSchema = z.object({
  email: z.string().email('Invalid email format'),
});

const ConfirmResetSchema = z.object({
  token:    z.string().min(1, 'Token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export class AuthController {
  /**
   * POST /api/v1/auth/register
   * Create a new staff user for the caller's restaurant.
   * Requires authentication — only admins of a restaurant can add users.
   */
  async register(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user?.restaurantId;
      if (!restaurantId) throw new Error('User not associated with a restaurant');

      const payload = RegisterRequestSchema.parse(req.body) as RegisterRequest;
      const response = await authService.register(payload, restaurantId);
      res.status(201).json(
        successResponse(response, {
          message: 'User registered successfully',
        })
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/login
   * Login user and get JWT token
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = LoginRequestSchema.parse(req.body) as LoginRequest;
      const response = await authService.login(payload);
      res.status(200).json(successResponse(response));
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/refresh
   * Refresh access token using refresh token
   */
  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = RefreshTokenRequestSchema.parse(req.body) as RefreshTokenRequest;
      const response = await authService.refresh(payload.refreshToken);
      res.status(200).json(successResponse(response));
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/auth/me
   * Get current user profile (requires authentication)
   */
  async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // User ID is attached by authenticate middleware
      const userId = (req as any).user?.userId;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const user = await authService.getProfile(userId);
      res.status(200).json(successResponse(user));
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/logout
   * Logout user (invalidate token on client side)
   */
  async logout(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;
      await authService.logout(refreshToken ?? '');
      res.status(200).json(successResponse({ message: 'Logged out successfully' }));
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/reset-password
   * Request a password reset email.
   * Always returns 200 — never reveals whether the email exists.
   */
  async requestReset(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = RequestResetSchema.parse(req.body);
      await authService.requestPasswordReset(email);
      // Always return the same message regardless of whether email exists
      res.status(200).json(
        successResponse({
          message: 'If that email is registered, a reset link has been sent.',
        })
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/confirm-reset
   * Confirm a password reset using the token from the email.
   */
  async confirmReset(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token, password } = ConfirmResetSchema.parse(req.body);
      await authService.confirmPasswordReset(token, password);
      res.status(200).json(
        successResponse({
          message: 'Password reset successfully. You can now log in with your new password.',
        })
      );
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
