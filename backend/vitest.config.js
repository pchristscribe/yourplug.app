import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    clearMocks: true,
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
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 50,
        statements: 60,
      },
    },
    setupFiles: ['./tests/setup.js'],
  },
})
