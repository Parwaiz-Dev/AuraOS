/**
 * superAdmin — platform-owner gate for cross-tenant endpoints.
 *
 * WHY THIS EXISTS
 * ───────────────
 * A few endpoints operate ACROSS all restaurants (e.g. "list every restaurant
 * on the platform"). A normal restaurant ADMIN must NOT be able to reach these
 * — that would leak other tenants' data. There is no SUPER_ADMIN role in the
 * users table (every admin belongs to exactly one restaurant), so we gate these
 * routes by an explicit email allowlist configured in the environment.
 *
 * CONFIG
 * ──────
 *   SUPER_ADMIN_EMAILS=owner@auraos.com,ops@auraos.com   (comma-separated)
 *
 * SAFE DEFAULT
 * ────────────
 * If SUPER_ADMIN_EMAILS is empty (the default), NO ONE passes this gate — the
 * cross-tenant endpoints are effectively closed until you opt in. This is the
 * secure-by-default behaviour you want for a multi-tenant SaaS.
 *
 * Use AFTER `authenticate` so req.user is populated:
 *   router.get('/', authenticate, superAdmin, handler)
 */

import { Response, NextFunction } from 'express';
import { ForbiddenError } from '../errors/AppError';
import { AuthenticatedRequest } from './authenticate';
import { isSuperAdminEmail } from '@/shared/utils/superAdmin';

export const superAdmin = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): void => {
  if (!req.user) {
    return next(new ForbiddenError('User not authenticated'));
  }

  if (!isSuperAdminEmail(req.user.email)) {
    // Don't reveal that this is a platform endpoint — generic forbidden.
    return next(new ForbiddenError('Access denied'));
  }

  next();
};
