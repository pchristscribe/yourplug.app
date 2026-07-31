import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Point tests at local Docker stack (same defaults as docker-compose.yml).
    // CI overrides these via actual process env vars, which take precedence.
    env: {
      TEST_DATABASE_URL: process.env.TEST_DATABASE_URL || 'postgresql://yourplug:dev_password_change_in_production@localhost:5432/yourplug_test',
      TEST_REDIS_URL: process.env.TEST_REDIS_URL || 'redis://:dev_redis_password@localhost:6379',
      SESSION_SECRET: process.env.SESSION_SECRET || 'test-session-secret-for-vitest-32chars!!',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      // Set just below the measured actuals so coverage can only ratchet
      // upward. The remaining gaps are src/routes/admin (blog-posts,
      // product-variants, consignment) and src/lib (stripe, supabase,
      // imageStorage) — raise these as those gain tests.
      thresholds: {
        lines: 65,
        functions: 65,
        branches: 55,
        statements: 65,

        // The consignment surface handles listings, images and money, so it
        // is held near its real numbers rather than the global bar.
        'src/routes/consignment/**': { lines: 90, functions: 85, branches: 85, statements: 90 },
        'src/schemas/**': { lines: 100, functions: 100, branches: 100, statements: 100 },
      },
    },
    setupFiles: ['./tests/setup.js'],
  },
})
