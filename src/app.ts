import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import authRoutes from '@/modules/auth/auth.routes';
import restaurantsRoutes from '@/modules/restaurants/restaurants.routes';
import tablesRoutes from '@/modules/tables/tables.routes';
import menuRoutes from '@/modules/menu/menu.routes';
import ordersRoutes from '@/modules/orders/orders.routes';
import paymentsRoutes from '@/modules/payments/payments.routes';
import inventoryRoutes from '@/modules/inventory/inventory.routes';
import reportsRoutes from '@/modules/reports/reports.routes';
import zomatoRoutes from '@/integrations/zomato/zomato.routes';
import whatsappRoutes from '@/integrations/whatsapp/whatsapp.routes';
import usersRoutes from '@/modules/users/users.routes';
import publicRoutes from '@/modules/public/public.routes';
import paymentWebhookRoutes from '@/modules/payments/payments.webhook';
import onboardingRoutes from '@/modules/onboarding/onboarding.routes';
import adminRoutes from '@/modules/admin/admin.routes';
import subscriptionsRoutes from '@/modules/subscriptions/subscriptions.routes';
import invoicesRoutes from '@/modules/subscriptions/invoices.routes';
import plansRoutes from '@/modules/subscriptions/plans.routes';
import modifiersRoutes from '@/modules/modifiers/modifier.routes';
import organizationsRoutes from '@/modules/organizations/organization.routes';
import { errorHandler } from '@/shared/middleware/errorHandler';
import { globalRateLimiter } from '@/shared/middleware/rateLimiter';
import { requestMonitor } from '@/shared/middleware/requestMonitor';
import healthRoutes from '@/shared/monitoring/health.routes';
import { env } from '@/config/env';

export function createApp(): Express {
  const app = express();

  // Parse allowed origins from env — supports comma-separated list
  const allowedOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean);

  app.use(helmet());
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (server-to-server, curl, Postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  }));
  app.use(morgan('combined'));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  // Request monitoring — measures duration + feeds metrics counters
  app.use(requestMonitor);
  // Global rate limiter — 300 req/min per IP
  app.use(globalRateLimiter);

  // Health, liveness, readiness & metrics endpoints
  //   GET /api/v1/health        — deep check (DB ping), public
  //   GET /api/v1/health/live   — liveness, public
  //   GET /api/v1/health/ready  — readiness, public
  //   GET /api/v1/metrics       — process/app metrics, admin only
  app.use('/api/v1', healthRoutes);

  // Status endpoint
  app.get('/api/v1/status', (req, res) => {
    res.json({
      success: true,
      data: {
        status: 'running',
        version: '1.0.0',
      },
    });
  });

  // Routes
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/restaurants', restaurantsRoutes);
  app.use('/api/v1/tables', tablesRoutes);
  app.use('/api/v1/menus', menuRoutes);
  app.use('/api/v1/orders', ordersRoutes);
  app.use('/api/v1/payments', paymentsRoutes);
  app.use('/api/v1/inventory', inventoryRoutes);
  app.use('/api/v1/reports', reportsRoutes);
  app.use('/api/v1/users', usersRoutes);
  app.use('/api/v1/public', publicRoutes);   // No auth — customer-facing
  app.use('/api/v1/webhooks/payments', paymentWebhookRoutes); // No auth — gateway webhooks
  app.use('/api/v1/onboarding', onboardingRoutes);  // No auth — new restaurant signup
  app.use('/api/v1/admin', adminRoutes);           // Mixed auth — public contact + super-admin management
  app.use('/api/v1/subscriptions', subscriptionsRoutes);
  app.use('/api/v1/invoices', invoicesRoutes);
  app.use('/api/v1/subscription-plans', plansRoutes);
  app.use('/api/v1/modifiers', modifiersRoutes);
  app.use('/api/v1/organizations', organizationsRoutes);
  app.use('/api/v1/integrations/zomato', zomatoRoutes);
  app.use('/api/v1/integrations/whatsapp', whatsappRoutes);

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Endpoint not found',
      },
    });
  });

  // Global error handler (must be last)
  app.use(errorHandler);

  return app;
}
