import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'happy-dom',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      // App-wide coverage. Pages are included so their absence from the
      // suite is visible in the number rather than hidden by a curated list.
      include: ['app/**/*.{ts,vue}'],
      exclude: [
        'app/types/**',      // type-only declarations, no runtime code
        'app/assets/**',     // stylesheets, not executable code
        'app/**/*.d.ts',
      ],
      // Global bar sits just below the measured actuals so coverage can only
      // ratchet upward. app/pages is untested and is what holds these numbers
      // down — raise the global bar as pages gain tests.
      thresholds: {
        statements: 56,
        lines: 57,
        functions: 49,
        branches: 41,

        // Layers that are actually unit-tested are held near their real
        // numbers, so a regression there fails the run even though the
        // global bar is lower. This preserves the guarantee the previous
        // curated include list provided.
        'app/components/**': { statements: 95, lines: 95, functions: 85, branches: 95 },
        'app/composables/**': { statements: 98, lines: 98, functions: 98, branches: 88 },
        'app/layouts/**': { statements: 100, lines: 100, functions: 100, branches: 100 },
        'app/middleware/**': { statements: 100, lines: 100, functions: 100, branches: 100 },
        'app/utils/**': { statements: 100, lines: 100, functions: 100, branches: 100 },
      },
    },
  },
  resolve: {
    alias: {
      '~': resolve(__dirname, './app'),
      '@': resolve(__dirname, './app'),
    },
  },
})
