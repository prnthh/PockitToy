import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { resolve } from 'path'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: false  // Disables SW/PWA in dev mode
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/localhost:\d{4}/,  // Dev pattern (though SW is disabled in dev)
            handler: 'NetworkFirst',  // Always use NetworkFirst for fresh content
            options: {
              cacheName: 'offline-shell',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 30 * 24 * 60 * 60,  // 30 days
              },
            },
          },
          // Add a prod-specific pattern
          // {
          //   urlPattern: /^https:\/\/your-prod-domain\.com/,
          //   handler: 'NetworkFirst',
          //   options: { ... }
          // }
        ],
        skipWaiting: true,
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: 'Pockit Toy',
        short_name: 'Pockit Toy',
        description: 'The most swag toy ever.',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'icon.png',
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
}))