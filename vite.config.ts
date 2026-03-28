import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueJsx(),
  ],
  server: {
    proxy: {
      '/auth': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/cards': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/accounts': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/transactions': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/recurring': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/budgets': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@components': fileURLToPath(new URL('./src/components', import.meta.url)),
    },
  },
})
