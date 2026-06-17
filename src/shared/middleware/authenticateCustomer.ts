import { Request, Response, NextFunction } from 'express';
import { verifyCustomerToken, type CustomerJWTPayload } from '@/modules/customers/customer-auth.service';
import { UnauthorizedError } from '@/shared/errors/AppError';

export interface CustomerRequest extends Request {
  customer?: CustomerJWTPayload;
}

/**
 * Authenticates a customer via their Bearer token (issued by customer OTP login).
 * Distinct from staff `authenticate` — customers are global, not restaurant-scoped.
 */
export function authenticateCustomer(req: CustomerRequest, _res: Response, next: NextFunction): void {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid authorization header');
    }
    req.customer = verifyCustomerToken(header.substring(7));
    next();
  } catch (err) {
    if (err instanceof UnauthorizedError) next(err);
    else next(new UnauthorizedError('Invalid or expired token'));
  }
}
