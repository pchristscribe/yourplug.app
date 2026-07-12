export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  future: {
    compatibilityVersion: 4,
  },

  devServer: {
    port: 3003,
  },

  modules: ['@nuxtjs/tailwindcss', 'nuxt-headlessui', '@nuxtjs/supabase', '@sentry/nuxt/module'],

  headlessui: {
    prefix: 'Headless',
  },

  supabase: {
    url: process.env.NUXT_PUBLIC_SUPABASE_URL,
    key: process.env.NUXT_PUBLIC_SUPABASE_KEY,
    redirectOptions: {
      login: '/login',
      callback: '/confirm',
      exclude: ['/', '/listings/*'],
    },
  },

  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:3001',
      supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL || '',
      supabaseKey: process.env.NUXT_PUBLIC_SUPABASE_KEY || '',
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3003',
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      titleTemplate: (chunk?: string) =>
        chunk && chunk !== 'Plug Market'
          ? `${chunk} · Plug Market`
          : 'Plug Market — Gay Community Consignment',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Buy and sell pre-loved gay lifestyle items — apparel, accessories, harnesses, and more.' },
        { name: 'theme-color', content: '#8B1E2D' },
        { property: 'og:site_name', content: 'Plug Market' },
        { property: 'og:type', content: 'website' },
        {
          'http-equiv': 'Content-Security-Policy',
          content: [
            "default-src 'self'",
            // No 'unsafe-inline' for scripts — it would defeat CSP's XSS protection
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "img-src 'self' https: data:",
            "font-src 'self' data: https://fonts.gstatic.com",
            // localhost is dev-only; production must not widen connect-src
            `connect-src 'self' ${process.env.NODE_ENV !== 'production' ? 'http://localhost:* ' : ''}https://*.supabase.co wss://*.supabase.co https://*.sentry.io https://js.stripe.com`,
            "base-uri 'self'",
            "form-action 'self' https://js.stripe.com",
          ].join('; '),
        },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
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
        port: 24676,
      },
    },
  },

  sentry: {
    org: 'yourplug',
    project: 'marketplace-nuxt',
  },

  sourcemap: {
    client: 'hidden',
  },
})
