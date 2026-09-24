import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import viteCompression from 'vite-plugin-compression'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendUrl = env.VITE_API_URL || 'http://localhost:8082'

  return {
    base: '/SIH26143_Oilguard/',
    plugins: [tailwindcss(), react(), viteCompression({ algorithm: 'gzip', threshold: 10240 })],
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
