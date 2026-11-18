import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

const pkg = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf-8'),
) as { version?: string }

export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: false },
  ssr: false,
  pages: true,
  srcDir: 'src',
  serverDir: 'server',
  imports: {
    scan: false,
  },
  components: [
    {
      path: '~/components',
      extensions: ['.vue'],
    },
  ],
  modules: ['@pinia/nuxt'],
  css: ['@/assets/main.css'],
  postcss: {
    plugins: {
      tailwindcss: {},
      autoprefixer: {},
    },
  },
  alias: {
    '@components': fileURLToPath(new URL('./src/components', import.meta.url)),
  },
  runtimeConfig: {
    jwtSecret: process.env.JWT_SECRET || 'dualpact-super-secret-jwt-key-dev',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    geminiModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
    public: {
      appVersion: pkg.version || '1.0.0',
    },
  },
  app: {
    head: {
      title: 'DuoPact Controle Financeiro a Dois',
      htmlAttrs: {
        lang: 'pt-BR',
      },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
    },
  },
})
