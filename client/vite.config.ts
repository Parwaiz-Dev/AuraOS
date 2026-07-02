import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Vite configuration for AuraOS Staff Portal PWA
 *
 * PWA SETUP
 * ─────────
 * The staff portal is a Progressive Web App so waiters and kitchen staff
 * can install it on their phones/tablets like a native app.
 *
 * To install on a device:
 *   1. Open http://YOUR_SERVER_IP:3001 in Chrome/Safari
 *   2. Tap the browser menu → "Add to Home Screen" / "Install App"
 *   3. The app opens full-screen with no browser chrome
 *
 * For production, serve over HTTPS — PWA install prompts require HTTPS
 * (localhost is exempt for development).
 *
 * ICONS
 * ─────
 * Icons are in client/public/:
 *   pwa-192x192.svg      → Android home screen icon
 *   pwa-512x512.svg      → Android splash screen
 *   apple-touch-icon.svg → iOS home screen icon
 *
 * Replace these SVGs with proper PNG icons before going to production.
 * Recommended tool: https://realfavicongenerator.net
 *
 * OFFLINE SUPPORT
 * ───────────────
 * workbox caches all JS/CSS/HTML so the app loads even without internet.
 * API calls still need connectivity — offline mode shows cached UI only.
 *
 * PORTS
 * ─────
 * Backend:  http://localhost:3000  (Express + Socket.io)
 * Frontend: http://localhost:3001  (Vite dev server)
 * The /api proxy forwards frontend requests to the backend.
 */

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      // 'autoUpdate' — service worker updates silently in background
      // Change to 'prompt' if you want to show "New version available" banner
      registerType: 'autoUpdate',

      // Cache all static assets for offline use
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Don't cache API calls — they need live data
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            // Cache menu images if you add them later
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: { maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 },
            },
          },
        ],
      },

      includeAssets: [
        'favicon.ico',
        'icon-512.png',
      ],

      // Web App Manifest — controls how the app looks when installed
      manifest: {
        name: 'AuraOS — Restaurant POS',
        short_name: 'AuraOS',
        description: 'Restaurant staff app — orders, kitchen, tables, payments',
        theme_color: '#0f1f3d',
        background_color: '#0f1f3d',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'en',

        icons: [
          {
            src: '/icon-512.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],

        // Shortcuts — appear when long-pressing the app icon on Android
        shortcuts: [
          {
            name: 'New Order',
            short_name: 'Order',
            description: 'Create a new order',
            url: '/orders',
            icons: [{ src: '/pwa-192x192.svg', sizes: '192x192' }],
          },
          {
            name: 'Kitchen Display',
            short_name: 'Kitchen',
            description: 'Open kitchen display',
            url: '/kitchen',
            icons: [{ src: '/pwa-192x192.svg', sizes: '192x192' }],
          },
          {
            name: 'Tables',
            short_name: 'Tables',
            description: 'View table status',
            url: '/tables',
            icons: [{ src: '/pwa-192x192.svg', sizes: '192x192' }],
          },
        ],

        // Categories for app stores
        categories: ['food', 'business', 'productivity'],
      },

      // Dev options — enable PWA in development for testing
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],

  server: {
    port: 3001,
    host: true,
    proxy: {
      '/ai-api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ai-api/, '/api/v1'),
      },
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },

  build: {
    // Generate source maps for production debugging
    sourcemap: false,
    // Split vendor chunks for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          ui: ['@heroicons/react', 'react-hot-toast'],
        },
      },
    },
  },
})
