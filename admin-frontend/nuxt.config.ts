export default defineNuxtConfig({
  compatibilityDate: '2025-11-29',
  devtools: { enabled: true },

  future: {
    compatibilityVersion: 4,
  },

  devServer: {
    port: 3002, // Admin frontend port
  },

  modules: [
    '@pinia/nuxt',
    '@nuxtjs/tailwindcss',
    '@nuxtjs/supabase',
    '@sentry/nuxt/module',
  ],

  css: ['~/assets/css/main.css'],

  supabase: {
    url: process.env.NUXT_PUBLIC_SUPABASE_URL,
    key: process.env.NUXT_PUBLIC_SUPABASE_KEY,
    serviceKey: process.env.SUPABASE_SECRET_KEY,
    redirectOptions: {
      login: '/login',
      callback: '/confirm',
      exclude: ['/*'],
    },
  },

  runtimeConfig: {
    public: {
      apiBase: process.env.API_BASE_URL || 'http://localhost:3001',
      supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL || '',
      supabaseKey: process.env.NUXT_PUBLIC_SUPABASE_KEY || '',
    }
  },

  app: {
    head: {
      title: 'yourplug Admin',
      meta: [
        { name: 'description', content: 'Admin panel for yourplug affiliate platform' },
        // Content Security Policy - Defense against XSS attacks
        {
          'http-equiv': 'Content-Security-Policy',
          content: [
            "default-src 'self'",
            `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV !== 'production' ? " 'unsafe-eval'" : ''}`,
            "style-src 'self' 'unsafe-inline' https://api.fontshare.com",
            "img-src 'self' https: data:",
            "font-src 'self' data: https://cdn.fontshare.com",
            "connect-src 'self' http://localhost:* https://*.supabase.co wss://*.supabase.co https://*.sentry.io",
            "base-uri 'self'",
            "form-action 'self'",
          ].join('; ')
        }
      ],
      link: [
        // Excon (headers) + General Sans (body) via Fontshare
        { rel: 'preconnect', href: 'https://api.fontshare.com' },
        { rel: 'preconnect', href: 'https://cdn.fontshare.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600,700&f[]=excon@400,500,700&display=swap',
        },
      ],
    }
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
        port: 24678,
        clientPort: 24678
      }
    }
  },

  sentry: {
    org: 'yourplug',
    project: 'admin-frontend-nuxt',
    authToken: process.env.SENTRY_AUTH_TOKEN
  },

  sourcemap: {
    client: 'hidden'
  }
})
