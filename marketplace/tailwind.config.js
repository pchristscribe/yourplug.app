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
        brand: {
          DEFAULT: '#8B1E2D',
          hover:   '#A3233A',
          active:  '#6E1622',
          muted:   '#F7EBEC',
        },
        accent: {
          DEFAULT: '#D6A77A',
          hover:   '#C4915F',
          muted:   '#FBF3EC',
        },
        surface: {
          light:   '#F7F7F7',
          DEFAULT: '#FFFFFF',
          dark:    '#2B2B2B',
          raised:  '#353535',
        },
        ink: {
          DEFAULT: '#2B2B2B',
          muted:   '#6B7280',
          subtle:  '#9CA3AF',
          inverse: '#F7F7F7',
        },
        status: {
          error:   '#8B1E2D',
          warning: '#D6A77A',
          success: '#2D6A4F',
          info:    '#1D4E89',
        },
      },
      fontFamily: {
        sans: ['Dosis', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        card:  '0.75rem',
        input: '0.5rem',
        pill:  '9999px',
      },
      boxShadow: {
        card:    '0 1px 3px 0 rgb(43 43 43 / 0.08), 0 1px 2px -1px rgb(43 43 43 / 0.06)',
        raised:  '0 4px 12px 0 rgb(43 43 43 / 0.12), 0 2px 4px -1px rgb(43 43 43 / 0.08)',
        overlay: '0 20px 48px 0 rgb(43 43 43 / 0.24)',
      },
    },
  },
  plugins: [],
}
