import { beforeAll, afterAll } from 'vitest'

// Load test environment variables
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
process.env.REDIS_URL = process.env.TEST_REDIS_URL || process.env.REDIS_URL

// Setup and teardown hooks
beforeAll(async () => {
  // Could initialize test database here if needed
})

afterAll(async () => {
  // Cleanup after all tests
})
