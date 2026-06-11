import { Router } from 'express';
import { authController } from './auth.controller';
import { authenticate } from '@/shared/middleware/authenticate';
import { authorize } from '@/shared/middleware/authorize';
import { authRateLimiter } from '@/shared/middleware/rateLimiter';

const router = Router();

// Register — authenticated ADMIN only; creates staff users for their restaurant.
// New restaurant signup goes through POST /api/v1/onboarding/register instead.
router.post('/register', authenticate, authorize('ADMIN'), authRateLimiter, (req, res, next) => authController.register(req, res, next));

// Login — rate limited to prevent brute-force
router.post('/login', authRateLimiter, (req, res, next) => authController.login(req, res, next));

// Refresh token
router.post('/refresh', (req, res, next) => authController.refresh(req, res, next));

// Password reset — rate limited (prevents email spam)
router.post('/reset-password',  authRateLimiter, (req, res, next) => authController.requestReset(req, res, next));
router.post('/confirm-reset',   authRateLimiter, (req, res, next) => authController.confirmReset(req, res, next));

/**
 * Protected routes (authentication required)
 */

// Get current user profile
router.get('/me', authenticate, (req, res, next) => authController.getProfile(req, res, next));

// Logout
router.post('/logout', authenticate, (req, res, next) => authController.logout(req, res, next));

export default router;
