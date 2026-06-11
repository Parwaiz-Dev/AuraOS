import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
        // Cache menu data for offline use
        runtimeCaching: [
          {
            urlPattern: /\/api\/v1\/menus/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'menu-cache',
              expiration: { maxAgeSeconds: 60 * 60 }, // 1 hour
            },
          },
          {
            urlPattern: /\/api\/v1\/tables/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'tables-cache',
              expiration: { maxAgeSeconds: 60 * 60 },
            },
          },
        ],
      },
      manifest: {
        name: 'AuraOS Waiter',
        short_name: 'Waiter',
        description: 'Take orders, manage tables, track status',
        theme_color: '#0f1f3d',
        background_color: '#0f1f3d',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icon-512.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
        shortcuts: [
          { name: 'New Order', url: '/order/new', icons: [{ src: '/pwa-192x192.svg', sizes: '192x192' }] },
          { name: 'My Orders', url: '/orders', icons: [{ src: '/pwa-192x192.svg', sizes: '192x192' }] },
        ],
      },
      devOptions: { enabled: true, type: 'module' },
    }),
  ],
  server: {
    port: 3002,
    host: true,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:3000', changeOrigin: true, ws: true },
    },
  },
})
