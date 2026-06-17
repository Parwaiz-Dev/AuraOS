/**
 * Zod-validated environment configuration.
 *
 * This file is the single source of truth for all environment variables.
 * It runs at startup and exits immediately with a clear error message
 * if any required variable is missing or invalid — no more cryptic
 * "Cannot read property of undefined" crashes deep in the code.
 *
 * Usage:
 *   import { env } from '@/config/env';
 *   const secret = env.JWT_SECRET;   // fully typed, always defined
 *
 * Adding a new variable:
 *   1. Add it to the EnvSchema below
 *   2. Add it to .env.example with a comment
 *   3. Add it to your .env file
 */

import { z } from 'zod';
import * as dotenv from 'dotenv';

// Load .env file before validation
dotenv.config();

// ── Schema ────────────────────────────────────────────────────────────────────

const EnvSchema = z.object({
  // Server
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z
    .string()
    .default('3000')
    .transform((v) => parseInt(v, 10))
    .refine((v) => v > 0 && v < 65536, 'PORT must be a valid port number'),

  // Database — required, no default
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required')
    .startsWith('postgresql://', 'DATABASE_URL must start with postgresql://'),

  // JWT — required, no default
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters for security'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Payment gateway (optional — defaults to 'none' = cash only)
  PAYMENT_GATEWAY: z
    .enum(['none', 'razorpay', 'stripe', 'cashfree', 'payu'])
    .default('none'),

  // Razorpay (only required if PAYMENT_GATEWAY=razorpay)
  RAZORPAY_KEY_ID:        z.string().optional().default(''),
  RAZORPAY_KEY_SECRET:    z.string().optional().default(''),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional().default(''),

  // Stripe (only required if PAYMENT_GATEWAY=stripe)
  STRIPE_SECRET_KEY:      z.string().optional().default(''),
  STRIPE_PUBLISHABLE_KEY: z.string().optional().default(''),
  STRIPE_WEBHOOK_SECRET:  z.string().optional().default(''),

  // Cashfree (only required if PAYMENT_GATEWAY=cashfree)
  CASHFREE_APP_ID:    z.string().optional().default(''),
  CASHFREE_SECRET_KEY: z.string().optional().default(''),
  CASHFREE_ENV:       z.enum(['TEST', 'PROD']).default('TEST'),

  // PayU (only required if PAYMENT_GATEWAY=payu)
  PAYU_MERCHANT_KEY:  z.string().optional().default(''),
  PAYU_MERCHANT_SALT: z.string().optional().default(''),
  PAYU_ENV:           z.enum(['test', 'production']).default('test'),

  // WhatsApp (optional — only needed for WhatsApp integration)
  WHATSAPP_VERIFY_TOKEN:    z.string().optional().default(''),
  WHATSAPP_ACCESS_TOKEN:    z.string().optional().default(''),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional().default(''),
  // App Secret — used to verify X-Hub-Signature-256 on incoming webhooks
  // Get from: Meta App Dashboard → Settings → Basic → App Secret
  WHATSAPP_APP_SECRET:      z.string().optional().default(''),

  // Zomato (optional — only needed for Zomato integration)
  ZOMATO_WEBHOOK_SECRET: z.string().optional().default(''),

  // Email / SMTP (for password reset emails)
  // Leave SMTP_HOST empty to use console logging in development
  SMTP_HOST:   z.string().optional().default(''),
  SMTP_PORT:   z.string().default('587').transform((v) => parseInt(v, 10)),
  SMTP_SECURE: z.string().default('false').transform((v) => v === 'true'),
  SMTP_USER:   z.string().optional().default(''),
  SMTP_PASS:   z.string().optional().default(''),
  EMAIL_FROM:  z.string().optional().default('AuraOS <no-reply@auraos.local>'),
  // Base URL of the frontend app (used in reset email links)
  APP_URL:     z.string().optional().default('http://localhost:3001'),

  // CORS — comma-separated list of allowed origins.
  // In production set this to your exact frontend domain(s).
  // Example: CORS_ORIGIN=https://app.yourrestaurant.com,https://admin.yourrestaurant.com
  // Defaults to localhost:3001 for development.
  CORS_ORIGIN: z.string().default('http://localhost:3001'),
  // Leave empty to use console + in-memory monitoring only.
  // Requires: npm install @sentry/node
  SENTRY_DSN:  z.string().optional().default(''),

  // Platform super-admins (optional) — comma-separated list of user emails
  // allowed to access cross-tenant endpoints (list/create restaurants).
  // Leave EMPTY to lock those endpoints for everyone (safe default).
  // Example: SUPER_ADMIN_EMAILS=owner@auraos.com,ops@auraos.com
  SUPER_ADMIN_EMAILS: z.string().optional().default(''),

  // Redis (optional) — enables tenant-config caching, OTP storage, distributed
  // rate limiting and Socket.io scaling. If unset, the app falls back to
  // PostgreSQL and in-memory stores. Example: redis://redis:6379
  REDIS_URL: z.string().optional().default(''),

  // Multi-tenant routing.
  // PLATFORM_DOMAIN: the apex under which restaurant subdomains live, so
  //   `pizza.auraos.com` resolves to the restaurant whose slug is `pizza`.
  // DEV_TENANT_SLUG: on localhost (no real subdomain) the host->tenant
  //   middleware uses this slug so the website is testable in development.
  PLATFORM_DOMAIN:  z.string().optional().default('auraos.com'),
  DEV_TENANT_SLUG:  z.string().optional().default(''),
});

// ── Validate ──────────────────────────────────────────────────────────────────

function validateEnv() {
  const result = EnvSchema.safeParse(process.env);

  if (!result.success) {
    console.error('\n❌ Invalid environment configuration:\n');
    result.error.issues.forEach((issue) => {
      console.error(`  • ${issue.path.join('.')}: ${issue.message}`);
    });
    console.error('\nFix the above issues in your .env file and restart.\n');
    process.exit(1);
  }

  // Cross-field validation: warn if gateway is set but keys are missing
  const data = result.data;
  if (data.PAYMENT_GATEWAY === 'razorpay' && !data.RAZORPAY_KEY_ID) {
    console.warn('⚠️  PAYMENT_GATEWAY=razorpay but RAZORPAY_KEY_ID is not set');
  }
  if (data.PAYMENT_GATEWAY === 'stripe' && !data.STRIPE_SECRET_KEY) {
    console.warn('⚠️  PAYMENT_GATEWAY=stripe but STRIPE_SECRET_KEY is not set');
  }

  return data;
}

// ── Export ────────────────────────────────────────────────────────────────────

export const env = validateEnv();

// Convenience type for use in other files
export type Env = typeof env;
