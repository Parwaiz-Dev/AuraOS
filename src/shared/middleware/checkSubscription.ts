import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './authenticate';
import { subscriptionsService } from '@/modules/subscriptions/subscriptions.service';
import { WRITE_ALLOWED_STATUSES } from '@/modules/subscriptions/subscriptions.types';
import { errorResponse } from '@/shared/utils/responseHandler';
import { env } from '@/config/env';

export async function checkSubscription(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId) {
      return next();
    }

    const status = await subscriptionsService.getEffectiveStatus(restaurantId);

    // No subscription row → allow (safety net; trial is auto-created on first read).
    if (!status || WRITE_ALLOWED_STATUSES.includes(status)) {
      return next();
    }

    // SUSPENDED / CANCELLED → block writes
    res.status(403).json(
      errorResponse(
        'Subscription inactive. Your account is read-only. Please renew to continue.',
        'SUBSCRIPTION_INACTIVE',
        { status },
      ),
    );
  } catch (error) {
    // In production, fail-closed: a subscription check error must not silently
    // grant access to a potentially suspended tenant.
    // In development, fail-open so a missing subscriptions table doesn't block work.
    if (env.NODE_ENV === 'production') {
      console.error('[checkSubscription] Error — blocking request (fail-closed):', error);
      res.status(503).json(
        errorResponse(
          'Service temporarily unavailable. Please try again.',
          'SERVICE_UNAVAILABLE',
        ),
      );
    } else {
      console.warn('[checkSubscription] Error — allowing request in dev mode:', error);
      next();
    }
  }
}
