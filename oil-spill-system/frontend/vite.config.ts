import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import viteCompression from 'vite-plugin-compression'
import path from 'path'
import fs from 'fs'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendUrl = env.VITE_API_URL || 'http://localhost:8082'

  return {
    base: '/SIH26143_Oilguard/',
    plugins: [
      tailwindcss(),
      react(),
      viteCompression({ algorithm: 'gzip', threshold: 10240 }),
      {
        // GitHub Pages serves 404.html for any unknown path under the site root.
        // Emitting a copy of the SPA shell there means /welcome and every other
        // deep link survives a refresh or a shared URL instead of dying on
        // GitHub's own 404 page.
        name: 'oilguard-spa-404-fallback',
        closeBundle() {
          const indexPath = path.resolve(__dirname, 'dist/index.html')
          if (!fs.existsSync(indexPath)) return
          fs.copyFileSync(indexPath, path.resolve(__dirname, 'dist/404.html'))
        },
      },
      {
        name: 'oilguard-base-path-redirect',
        configureServer(server) {
          server.middlewares.use((request, response, next) => {
            const requestUrl = request.url ?? ''
            const pathname = requestUrl.split('?')[0]
            if (pathname !== '/SIH26143_Oilguard') {
              next()
              return
            }

            const queryIndex = requestUrl.indexOf('?')
            const query = queryIndex >= 0 ? requestUrl.slice(queryIndex) : ''
            response.statusCode = 308
            response.setHeader('Location', `/SIH26143_Oilguard/${query}`)
            response.end()
          })
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-router-dom', 'maplibre-gl', 'zustand'],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            maplibre: ['maplibre-gl'],
            deck: ['@deck.gl/core', '@deck.gl/layers', '@deck.gl/mapbox'],
          },
        },
      },
    },
    server: {
      port: 3000,
      warmup: {
        clientFiles: ['./src/main.tsx', './src/App.tsx', './src/components/Layout.tsx'],
      },
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
        },
        '/ws': {
          target: backendUrl.replace('http', 'ws'),
          ws: true,
        },
      },
    },
  }
})
