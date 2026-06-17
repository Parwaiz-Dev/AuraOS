/**
 * Rate limiting middleware.
 *
 * Protects sensitive endpoints from brute-force attacks.
 * Uses in-memory store (suitable for single-instance deployments).
 * For multi-instance deployments, replace with Redis store:
 *   npm install rate-limit-redis ioredis
 *   store: new RedisStore({ client: redisClient })
 */

import rateLimit from 'express-rate-limit';

/**
 * Auth rate limiter — applied to /auth/login and /auth/register.
 * 10 attempts per 15 minutes per IP.
 * Prevents brute-force password attacks.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,  // Return rate limit info in RateLimit-* headers
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many attempts. Please try again in 15 minutes.',
    },
  },
  // Skip rate limiting in test environment
  skip: () => process.env.NODE_ENV === 'test',
});

/**
 * Public order rate limiter — applied to /public/order/:slug.
 * 30 orders per 10 minutes per IP.
 * Prevents spam orders from QR page.
 */
export const publicOrderRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many orders. Please wait a few minutes.',
    },
  },
  skip: () => process.env.NODE_ENV === 'test',
});

/**
 * Customer OTP rate limiter — applied to /customers/otp/request and /verify.
 * 5 requests per 10 minutes per IP. Strict, because each request can trigger an
 * SMS — this blunts SMS-bombing and cost-abuse on the public surface.
 */
export const otpRequestRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many code requests. Please wait a few minutes.',
    },
  },
  skip: () => process.env.NODE_ENV === 'test',
});

/**
 * General API rate limiter — applied globally.
 * 300 requests per minute per IP.
 * Prevents API abuse.
 */
export const globalRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests. Please slow down.',
    },
  },
  skip: () => process.env.NODE_ENV === 'test',
});
