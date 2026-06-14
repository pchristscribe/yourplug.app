// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  devServer: {
    port: 3000,
  },

  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt', 'nuxt-headlessui', '@nuxtjs/supabase', '@sentry/nuxt/module'],

  // Optionally change the default prefix.
  headlessui: {
    prefix: 'Headless'
  },

  supabase: {
    url: process.env.NUXT_PUBLIC_SUPABASE_URL,
    key: process.env.NUXT_PUBLIC_SUPABASE_KEY,
    redirectOptions: {
      login: '/login',
      callback: '/confirm',
      exclude: ['/*'],
    },
  },

  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:3001',
      supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL || '',
      supabaseKey: process.env.NUXT_PUBLIC_SUPABASE_KEY || '',
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      titleTemplate: (chunk?: string) =>
        chunk && chunk !== 'yourplug'
          ? `${chunk} · yourplug`
          : 'yourplug — Curated Products for Gay Men',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Discover curated products from DHgate, AliExpress, Amazon, and Wish — reviewed and hand-picked for our community.' },
        { name: 'theme-color', content: '#8B1E2D' },
        // Open Graph defaults (pages override per-route via useSeoMeta)
        { property: 'og:site_name', content: 'yourplug' },
        { property: 'og:type', content: 'website' },
        { property: 'og:title', content: 'yourplug — Curated Products for Gay Men' },
        { property: 'og:description', content: 'Discover curated products from DHgate, AliExpress, Amazon, and Wish.' },
        // Twitter defaults
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: 'yourplug — Curated Products for Gay Men' },
        { name: 'twitter:description', content: 'Discover curated products from DHgate, AliExpress, Amazon, and Wish.' },
        {
          'http-equiv': 'Content-Security-Policy',
          content: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline'",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "img-src 'self' https: data:",
            "font-src 'self' data: https://fonts.gstatic.com",
            "connect-src 'self' http://localhost:* https://*.supabase.co wss://*.supabase.co https://*.sentry.io",
            "base-uri 'self'",
            "form-action 'self'",
          ].join('; ')
        },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        // Dosis variable font (weights 200–800) via Google Fonts
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Dosis:wght@200..800&display=swap',
        },
      ],
    },
  },

  routeRules: {
    '/**': {
      headers: {
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
        'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
      },
    },
  },

  vite: {
    server: {
      hmr: {
        port: 24677 // Changed to avoid conflict with admin-frontend
      }
    }
  }
})
