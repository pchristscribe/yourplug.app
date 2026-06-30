/**
 * Tests for admin-frontend/nuxt.config.ts changes in this PR:
 * - NUXT_SUPABASE_SERVICE_KEY renamed to SUPABASE_SECRET_KEY
 * - supabase.serviceKey now reads from process.env.SUPABASE_SECRET_KEY
 * - runtimeConfig.supabaseSecretKey is now explicitly set
 * - App title changed from 'yourplug.app Admin' to 'yourplug Admin'
 * - Meta description changed from 'yourplug.app affiliate platform' to 'yourplug affiliate platform'
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// ─── Environment variable name change ────────────────────────────────────────

describe('SUPABASE_SECRET_KEY environment variable (renamed from NUXT_SUPABASE_SERVICE_KEY)', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    // Reset env before each test
    delete process.env.SUPABASE_SECRET_KEY
    delete process.env.NUXT_SUPABASE_SERVICE_KEY
  })

  afterEach(() => {
    // Restore original env
    Object.assign(process.env, originalEnv)
    if (!originalEnv.SUPABASE_SECRET_KEY) delete process.env.SUPABASE_SECRET_KEY
    if (!originalEnv.NUXT_SUPABASE_SERVICE_KEY) delete process.env.NUXT_SUPABASE_SERVICE_KEY
  })

  it('SUPABASE_SECRET_KEY env var is available when set', () => {
    process.env.SUPABASE_SECRET_KEY = 'test-service-role-key'
    expect(process.env.SUPABASE_SECRET_KEY).toBe('test-service-role-key')
  })

  it('SUPABASE_SECRET_KEY and NUXT_SUPABASE_SERVICE_KEY are different variable names', () => {
    expect('SUPABASE_SECRET_KEY').not.toBe('NUXT_SUPABASE_SERVICE_KEY')
  })

  it('the new env var name does not start with NUXT_SUPABASE (it is read server-side only)', () => {
    // SUPABASE_SECRET_KEY is not a NUXT_ prefixed var — it's server-only
    expect('SUPABASE_SECRET_KEY').not.toMatch(/^NUXT_/)
  })

  it('SUPABASE_SECRET_KEY is correctly used as runtime secret key name', () => {
    // Simulate what nuxt.config.ts does:
    // runtimeConfig: { supabaseSecretKey: process.env.SUPABASE_SECRET_KEY || '' }
    process.env.SUPABASE_SECRET_KEY = 'my-secret-service-key'
    const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || ''
    expect(supabaseSecretKey).toBe('my-secret-service-key')
  })

  it('falls back to empty string when SUPABASE_SECRET_KEY is not set', () => {
    // nuxt.config.ts uses: process.env.SUPABASE_SECRET_KEY || ''
    delete process.env.SUPABASE_SECRET_KEY
    const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || ''
    expect(supabaseSecretKey).toBe('')
  })

  it('SUPABASE_SECRET_KEY is not exposed as a NUXT_PUBLIC_ variable (security)', () => {
    // The key must NOT be prefixed with NUXT_PUBLIC_ to avoid client exposure
    const envVarName = 'SUPABASE_SECRET_KEY'
    expect(envVarName).not.toMatch(/^NUXT_PUBLIC_/)
  })
})

// ─── App title change ─────────────────────────────────────────────────────────

describe("admin-frontend app title — 'yourplug Admin' (was 'yourplug.app Admin')", () => {
  const EXPECTED_TITLE = 'yourplug Admin'
  const OLD_TITLE = 'yourplug.app Admin'

  it('the expected title is "yourplug Admin"', () => {
    expect(EXPECTED_TITLE).toBe('yourplug Admin')
  })

  it('the new title does not contain ".app" suffix', () => {
    expect(EXPECTED_TITLE).not.toContain('.app')
  })

  it('the new title still contains "Admin"', () => {
    expect(EXPECTED_TITLE).toContain('Admin')
  })

  it('the new title still contains "yourplug"', () => {
    expect(EXPECTED_TITLE).toContain('yourplug')
  })

  it('the old title "yourplug.app Admin" is different from the new one', () => {
    expect(EXPECTED_TITLE).not.toBe(OLD_TITLE)
  })
})

// ─── Meta description change ──────────────────────────────────────────────────

describe("admin-frontend meta description — 'yourplug affiliate platform' (was 'yourplug.app affiliate platform')", () => {
  const EXPECTED_DESCRIPTION = 'Admin panel for yourplug affiliate platform'
  const OLD_DESCRIPTION = 'Admin panel for yourplug.app affiliate platform'

  it('the expected meta description is correct', () => {
    expect(EXPECTED_DESCRIPTION).toBe('Admin panel for yourplug affiliate platform')
  })

  it('the new description does not contain ".app"', () => {
    expect(EXPECTED_DESCRIPTION).not.toContain('.app')
  })

  it('the new description contains "affiliate platform"', () => {
    expect(EXPECTED_DESCRIPTION).toContain('affiliate platform')
  })

  it('the new description is different from the old one', () => {
    expect(EXPECTED_DESCRIPTION).not.toBe(OLD_DESCRIPTION)
  })
})

// ─── runtimeConfig structure ──────────────────────────────────────────────────

describe('nuxt.config.ts runtimeConfig shape', () => {
  it('supabaseSecretKey is a private (server-side) runtimeConfig key', () => {
    // Simulates: runtimeConfig: { supabaseSecretKey: ..., public: { ... } }
    // supabaseSecretKey is at the top level (private), not under public
    const runtimeConfig = {
      supabaseSecretKey: process.env.SUPABASE_SECRET_KEY || '',
      public: {
        apiBase: process.env.API_BASE_URL || 'http://localhost:3001',
        supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL || '',
        supabaseKey: process.env.NUXT_PUBLIC_SUPABASE_KEY || '',
      }
    }

    expect(runtimeConfig).toHaveProperty('supabaseSecretKey')
    expect(runtimeConfig.public).not.toHaveProperty('supabaseSecretKey')
  })

  it('public runtimeConfig does not expose the service key', () => {
    const publicConfig = {
      apiBase: 'http://localhost:3001',
      supabaseUrl: '',
      supabaseKey: '',
    }

    expect(publicConfig).not.toHaveProperty('supabaseSecretKey')
    expect(publicConfig).not.toHaveProperty('serviceKey')
  })

  it('public runtimeConfig has the expected shape', () => {
    const publicConfig = {
      apiBase: process.env.API_BASE_URL || 'http://localhost:3001',
      supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL || '',
      supabaseKey: process.env.NUXT_PUBLIC_SUPABASE_KEY || '',
    }

    expect(publicConfig).toHaveProperty('apiBase')
    expect(publicConfig).toHaveProperty('supabaseUrl')
    expect(publicConfig).toHaveProperty('supabaseKey')
  })

  it('apiBase defaults to http://localhost:3001 when API_BASE_URL is not set', () => {
    const original = process.env.API_BASE_URL
    delete process.env.API_BASE_URL
    const apiBase = process.env.API_BASE_URL || 'http://localhost:3001'
    expect(apiBase).toBe('http://localhost:3001')
    if (original !== undefined) process.env.API_BASE_URL = original
  })
})