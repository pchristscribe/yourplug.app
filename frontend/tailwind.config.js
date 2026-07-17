export default {
  darkMode: 'class',
  content: [
    './app/components/**/*.{js,vue,ts}',
    './app/layouts/**/*.vue',
    './app/pages/**/*.vue',
    './app/plugins/**/*.{js,ts}',
    './app/app.vue',
  ],
  theme: {
    extend: {
      colors: {
        // ─── Primary action color ─────────────────────────────────────
        // Deep Red — used for CTAs, links, active states
        brand: {
          DEFAULT: '#8B1E2D',
          hover:   '#A3233A',  // lifted ~12% lightness — filled button hover
          active:  '#6E1622',  // pressed / active state
          muted:   '#F7EBEC',  // light tint — badge bg, selected row bg
        },

        // ─── Warm accent ──────────────────────────────────────────────
        // Skin Tone — secondary highlights, tags, decorative elements
        accent: {
          DEFAULT: '#D6A77A',
          hover:   '#C4915F',  // 10% darker — hover on accent elements
          muted:   '#FBF3EC',  // near-white warm tint — subtle bg washes
        },

        // ─── Surfaces ─────────────────────────────────────────────────
        // Light / Dark mode background layers
        surface: {
          light:   '#F7F7F7',  // Off White — light mode page/card bg
          DEFAULT: '#FFFFFF',  // pure white — modals, input fields
          dark:    '#2B2B2B',  // Charcoal — dark mode page bg
          raised:  '#353535',  // slightly lighter than charcoal — dark mode cards
        },

        // ─── Text & UI chrome ─────────────────────────────────────────
        ink: {
          DEFAULT: '#2B2B2B',  // Charcoal — primary body text
          muted:   '#6B7280',  // Steel Gray — secondary text, placeholders, labels
          subtle:  '#9CA3AF',  // even lighter — disabled text, hints
          inverse: '#F7F7F7',  // Off White — text on dark backgrounds
        },

        // ─── Semantic aliases (status colors) ─────────────────────────
        // Keep these close to standard Tailwind but named semantically
        status: {
          error:   '#8B1E2D',  // reuse brand red for errors — intentional unity
          warning: '#D6A77A',  // reuse skin accent for warnings — warm, not alarming
          success: '#2D6A4F',  // forest green — distinct from brand palette
          info:    '#1D4E89',  // deep blue — neutral informational
        },
      },

      // ─── Typography ─────────────────────────────────────────────────
      fontFamily: {
        sans: ['General Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        heading: ['Excon', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },

      // ─── Border radius ───────────────────────────────────────────────
      borderRadius: {
        card:   '0.75rem',  // 12px — product cards, panels
        input:  '0.5rem',   // 8px — form inputs, small buttons
        pill:   '9999px',   // fully rounded — tags, badges
      },

      // ─── Shadows (elevation) ─────────────────────────────────────────
      boxShadow: {
        card:    '0 1px 3px 0 rgb(43 43 43 / 0.08), 0 1px 2px -1px rgb(43 43 43 / 0.06)',
        raised:  '0 4px 12px 0 rgb(43 43 43 / 0.12), 0 2px 4px -1px rgb(43 43 43 / 0.08)',
        overlay: '0 20px 48px 0 rgb(43 43 43 / 0.24)',
      },

      // ─── Motion ──────────────────────────────────────────────────────
      transitionDuration: {
        fast:   '150ms',  // micro-interactions: button press, checkbox
        base:   '200ms',  // most hover transitions
        slow:   '300ms',  // drawers, dropdowns, page-level
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',  // standard ease-in-out
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',  // slight overshoot for modals
      },
    },
  },
  plugins: [],
}
