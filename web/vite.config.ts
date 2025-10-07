import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { resolve } from 'path'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',  // Auto-registers and updates the SW
      workbox: {
        // Minimal caching: Cache all local assets for offline use
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            // Cache the app shell (index.html and assets)
            urlPattern: /^https?:\/\/localhost:\d{4}/,  // Adjust for your dev/prod URL
            handler: 'CacheFirst',
            options: {
              cacheName: 'offline-shell',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 30 * 24 * 60 * 60,  // 30 days
              },
            },
          },
        ],
        skipWaiting: true,  // Activates new SW immediately after install
        cleanupOutdatedCaches: true,  // Clears old caches on activate
      },
      manifest: {
        // Customize this for your counter app
        name: 'Pockit Toy',
        short_name: 'Pockit Toy',
        description: 'The most swag toy ever.',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',  // Fullscreen like a native app
        start_url: '/',
        icons: [
          {
            src: 'icon.png',  // Add a 512x512 PNG icon to public/
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@/': resolve(__dirname, 'src') + '/',
      '@': resolve(__dirname, 'src')
    }
  }
})
