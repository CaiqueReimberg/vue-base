import { fileURLToPath, URL } from 'node:url'

export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: false },
  ssr: false,
  pages: true,
  srcDir: 'src',
  serverDir: 'server',
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
  },
  app: {
    head: {
      title: 'DuoPact — Controle Financeiro a Dois',
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
