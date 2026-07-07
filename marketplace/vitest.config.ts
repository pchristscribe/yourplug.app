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
      // Enforce the >80% guideline on unit-tested modules so regressions
      // fail the run. Widen this include list as page/component coverage grows —
      // an app-wide 80% gate today would just be permanently red.
      include: [
        'app/composables/useListings.ts',
        'app/composables/useAuthHeaders.ts',
        'app/composables/useOffers.ts',
        'app/composables/useSeller.ts',
        'app/composables/useSellerAccount.ts',
        'app/components/ListingCard.vue',
        'app/utils/listingLabels.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
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
