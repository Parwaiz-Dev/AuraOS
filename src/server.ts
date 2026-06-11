import * as dotenv from 'dotenv';
import { createApp } from '@/app';
import { testDatabaseConnection } from '@/config/database';
import { pool } from '@/config/database';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { initializeEventBroadcaster } from '@/shared/socket/eventBroadcaster';
import { env } from '@/config/env';
import jwt from 'jsonwebtoken';
import { startJobs, stopJobs } from '@/shared/jobs/jobRunner';
import { initMonitoring } from '@/shared/monitoring/monitoring';

// Load environment variables
dotenv.config();

const PORT = parseInt(process.env.PORT || '3000', 10);

// Start server
async function startServer() {
  try {
    // Test database connection before starting
    const dbConnected = await testDatabaseConnection();

    if (!dbConnected) {
      console.warn('⚠️  Database connection failed, but continuing...');
    }

    // Initialise monitoring (Sentry if SENTRY_DSN is configured, else console)
    initMonitoring();

    const app = createApp();
    const httpServer = createServer(app);
    const io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });

    initializeEventBroadcaster(io);

    // ── Socket.io connection handler ──────────────────────────────────────────
    // Authenticates socket connections via JWT and manages restaurant-room
    // membership so that real-time event broadcasts reach the correct tenants.
    io.on('connection', (socket) => {
      const token: string | undefined = socket.handshake.auth?.token;

      if (!token) {
        socket.disconnect(true);
        return;
      }

      try {
        const decoded = jwt.verify(token, env.JWT_SECRET) as {
          id: string;
          email: string;
          role: string;
          restaurantId: string;
        };

        // Join the restaurant-scoped room so the socket receives broadcasts
        // targeted at this tenant's restaurant.
        socket.on('join_restaurant', (data: { restaurantId: string }) => {
          if (data?.restaurantId) {
            socket.join(`restaurant:${data.restaurantId}`);
          }
        });

        socket.on('disconnect', () => {
          // socket.io automatically leaves all rooms on disconnect;
          // no explicit cleanup needed here.
        });
      } catch {
        // Token is invalid or expired — reject the connection
        socket.disconnect(true);
      }
    });

    httpServer.listen(PORT, () => {
      console.log('\n╔═════════════════════════════════════════════╗');
      console.log('║       🚀 AuraOS Server Started              ║');
      console.log('╚═════════════════════════════════════════════╝\n');
      console.log(`Port: ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV}`);
      console.log(`Database: ${dbConnected ? 'Connected ✅' : 'Disconnected ⚠️'}`);
      console.log('\n✨ Server is ready to accept requests');
      console.log('\n📝 Available endpoints:');
      console.log('   GET  /api/v1/health');
      console.log('   GET  /api/v1/status');
      console.log('');
      console.log('   Authentication:');
      console.log('   POST /api/v1/auth/register');
      console.log('   POST /api/v1/auth/login');
      console.log('   POST /api/v1/auth/refresh');
      console.log('   GET  /api/v1/auth/me (requires token)');
      console.log('   POST /api/v1/auth/logout (requires token)');
      console.log('');
      console.log('   Restaurants:');
      console.log('   POST /api/v1/restaurants (admin only)');
      console.log('   GET  /api/v1/restaurants (admin only)');
      console.log('   GET  /api/v1/restaurants/me (authenticated)');
      console.log('   PUT  /api/v1/restaurants/me (admin only)');
      console.log('   GET  /api/v1/restaurants/me/stats (admin only)');
      console.log('   DELETE /api/v1/restaurants/me (admin only)');
      console.log('   GET  /api/v1/restaurants/:slug (public)');
      console.log('');
      console.log('   Tables:');
      console.log('   GET  /api/v1/tables (authenticated)');
      console.log('   GET  /api/v1/tables/stats (admin only)');
      console.log('   GET  /api/v1/tables/:id (authenticated)');
      console.log('   POST /api/v1/tables (admin only)');
      console.log('   PUT  /api/v1/tables/:id (admin only)');
      console.log('   DELETE /api/v1/tables/:id (admin only)');
      console.log('');
      console.log('   Menu:');
      console.log('   GET  /api/v1/menus (authenticated)');
      console.log('   GET  /api/v1/menus/stats (admin only)');
      console.log('   GET  /api/v1/menus/categories (authenticated)');
      console.log('   GET  /api/v1/menus/categories/:id (authenticated)');
      console.log('   POST /api/v1/menus/categories (admin only)');
      console.log('   PUT  /api/v1/menus/categories/:id (admin only)');
      console.log('   DELETE /api/v1/menus/categories/:id (admin only)');
      console.log('   GET  /api/v1/menus/items (authenticated)');
      console.log('   GET  /api/v1/menus/items/:id (authenticated)');
      console.log('   POST /api/v1/menus/items (admin only)');
      console.log('   PUT  /api/v1/menus/items/:id (admin only)');
      console.log('   DELETE /api/v1/menus/items/:id (admin only)');
      console.log('');
      console.log('   Orders:');
      console.log('   POST /api/v1/orders (authenticated)');
      console.log('   GET  /api/v1/orders (authenticated)');
      console.log('   GET  /api/v1/orders/stats (admin only)');
      console.log('   GET  /api/v1/orders/:id (authenticated)');
      console.log('   PUT  /api/v1/orders/:id (KITCHEN, ADMIN)');
      console.log('   DELETE /api/v1/orders/:id (admin only)');
      console.log('');
      // Start background jobs (delay detector, inventory sync)
      startJobs();
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n🛑 SIGTERM received, shutting down gracefully...');
  stopJobs();
  pool.end();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n🛑 SIGINT received, shutting down gracefully...');
  stopJobs();
  pool.end();
  process.exit(0);
});

// Catch unhandled promise rejections — log but don't crash (crash-only
// philosophy can be opted into via process manager like pm2).
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Catch uncaught exceptions — attempt graceful shutdown before exiting
// because the process is in an undefined state.
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  stopJobs();
  pool.end().finally(() => process.exit(1));
});
