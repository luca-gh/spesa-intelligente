import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { loadEnv } from 'vite'
import { assertPublicEnvironment } from './src/domain/config.ts'
import { onRequest } from './functions/api/products/[barcode].ts'

export default defineConfig(({ mode }) => {
  assertPublicEnvironment(loadEnv(mode, process.cwd(), 'VITE_'))
  return {
    optimizeDeps: { include: ['@zxing/browser', '@zxing/library'] },
    plugins: [
      react(),
      {
        name: 'local-barcode-api',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const url = new URL(req.url ?? '/', 'http://localhost')
            if (!url.pathname.startsWith('/api/products/')) return next()
            const response = await onRequest({
              request: new Request(url, { method: req.method ?? 'GET' }),
              params: { barcode: url.pathname.slice('/api/products/'.length) },
            })
            res.statusCode = response.status
            response.headers.forEach((value, key) => res.setHeader(key, value))
            res.end(await response.text())
          })
        },
      },
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['icon.svg', 'apple-touch-icon.png', 'offline.html'],
        manifest: {
          name: 'Spesa Intelligente',
          short_name: 'Spesa',
          lang: 'it',
          description: 'La spesa di famiglia, insieme.',
          theme_color: '#23634d',
          background_color: '#f7f8f2',
          display: 'standalone',
          start_url: './',
          icons: [
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: 'icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/auth\//, /^\/api\//],
          cleanupOutdatedCaches: true,
        },
      }),
    ],
    test: { include: ['tests/**/*.test.ts'], testTimeout: 30000 },
  }
})
