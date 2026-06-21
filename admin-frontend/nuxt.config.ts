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

  supabase: {
    url: process.env.NUXT_PUBLIC_SUPABASE_URL,
    key: process.env.NUXT_PUBLIC_SUPABASE_KEY,
    // SECURITY: Do NOT set serviceKey here with process.env — that bakes the value
    // into the Nitro server bundle at build time. Instead, the @nuxtjs/supabase module
    // reads NUXT_SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_KEY) at *runtime* via its
    // own env-var lookup, so no secret is ever embedded in the build artifact.
    // serverSupabaseServiceRole() is not used by this app (all admin CRUD goes through
    // the Fastify backend), so leaving serviceKey unset is intentional.
    redirectOptions: {
      login: '/login',
      callback: '/confirm',
      exclude: ['/*'],
    },
  },

  runtimeConfig: {
    // SECURITY: Server-only runtime config — never serialized into the client bundle.
    // Do NOT move anything here into runtimeConfig.public.
    // Also do NOT assign process.env.SUPABASE_SECRET_KEY here: Nuxt bakes
    // runtimeConfig default values into the server bundle at build time.
    // If a Nitro server route ever needs the service key, use the env-var name
    // NUXT_SUPABASE_SERVICE_KEY (read at runtime by the @nuxtjs/supabase module)
    // or NUXT_SUPABASE_SECRET_KEY (read at runtime by Nuxt for runtimeConfig.supabase.secretKey).
    public: {
      apiBase: process.env.API_BASE_URL || 'http://localhost:3001',
      supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL || '',
      supabaseKey: process.env.NUXT_PUBLIC_SUPABASE_KEY || '',
    }
  },

  app: {
    head: {
      title: 'yourplug.app Admin',
      meta: [
        { name: 'description', content: 'Admin panel for yourplug.app affiliate platform' },
        // Content Security Policy - Defense against XSS attacks
        {
          'http-equiv': 'Content-Security-Policy',
          content: [
            "default-src 'self'",
            `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV !== 'production' ? " 'unsafe-eval'" : ''}`,
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "img-src 'self' https: data:",
            "font-src 'self' data: https://fonts.gstatic.com",
            "connect-src 'self' http://localhost:* https://*.supabase.co wss://*.supabase.co https://*.sentry.io",
            "base-uri 'self'",
            "form-action 'self'",
          ].join('; ')
        }
      ],
      link: [
        // Dosis variable font (weights 200–800) via Google Fonts
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Dosis:wght@200..800&display=swap',
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
    project: 'admin-frontend-nuxt'
  },

  sourcemap: {
    client: 'hidden'
  }
})
