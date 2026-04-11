import { fileURLToPath, URL } from 'node:url'

import { defineConfig, type ProxyOptions } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'

/**
 * Caminhos da API Nest (@Controller). Se faltar aqui, o Vite devolve 404 (HTML)
 * e parece que a "página" sumiu — na verdade o fetch não chegou na API.
 * Ao adicionar controller novo na API, inclua o prefixo aqui.
 */
const API_PREFIXES = [
  '/auth',
  '/accounts',
  '/cards',
  '/transactions',
  '/recurring',
  '/budgets',
  '/categories',
  '/users',
  '/family',
  '/health',
] as const

const API_PROXY_TARGET = process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:3000'

function createApiProxy(target: string): ProxyOptions {
  return {
    target,
    changeOrigin: true,
    /**
     * Rotas do Vue e da API compartilham caminhos (/cards, /accounts…).
     * Em F5 ou abrir URL direto, o navegador pede HTML → entrega o SPA.
     * fetch costuma não enviar Accept: text/html → segue para a API.
     */
    bypass(req) {
      const accept = req.headers.accept ?? ''
      if (accept.includes('text/html')) {
        return '/index.html'
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), vueJsx()],
  server: {
    proxy: Object.fromEntries(
      API_PREFIXES.map((prefix) => [prefix, createApiProxy(API_PROXY_TARGET)]),
    ),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@components': fileURLToPath(new URL('./src/components', import.meta.url)),
    },
  },
})
