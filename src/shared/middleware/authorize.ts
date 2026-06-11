import { Response, NextFunction } from 'express';
import { ForbiddenError } from '../errors/AppError';
import { AuthenticatedRequest } from './authenticate';

/**
 * Authorization middleware
 * Checks if user has required role
 * Usage: authorize('ADMIN', 'MANAGER')
 */
export const authorize = (...allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new ForbiddenError('User not authenticated'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Access denied. Required role(s): ${allowedRoles.join(', ')}`
        )
      );
    }

    next();
  };
};
