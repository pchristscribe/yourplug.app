/**
 * Page tests for diagnostic.vue — this page previously had zero coverage.
 * Its onMounted checks are gated behind `process.client`, which is falsy
 * by default under plain Node/Vitest, so it's stubbed true here to exercise
 * the same branches Nuxt's client build would run.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, computed, onMounted } from 'vue'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('onMounted', onMounted)
vi.stubGlobal('definePageMeta', vi.fn())
vi.stubGlobal('process', { ...process, client: true })

const mockConfig = { public: { apiBase: 'http://localhost:3001' } }
vi.stubGlobal('useRuntimeConfig', vi.fn(() => mockConfig))

const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

const DiagnosticPage = (await import('../app/pages/diagnostic.vue')).default

function stubWebAuthn(available: boolean | 'throws') {
  const isUserVerifyingPlatformAuthenticatorAvailable =
    available === 'throws'
      ? vi.fn().mockRejectedValue(new Error('not supported'))
      : vi.fn().mockResolvedValue(available)

  vi.stubGlobal('PublicKeyCredential', { isUserVerifyingPlatformAuthenticatorAvailable })
  Object.defineProperty(window, 'PublicKeyCredential', {
    value: { isUserVerifyingPlatformAuthenticatorAvailable },
    configurable: true,
  })
}

function clearWebAuthn() {
  // @ts-expect-error - deliberately removing the global to simulate unsupported browsers
  delete window.PublicKeyCredential
}

async function mountPage() {
  const wrapper = mount(DiagnosticPage)
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  mockFetch.mockReset()
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true })
  Object.defineProperty(window, 'location', {
    value: { origin: 'http://localhost:3002', href: 'http://localhost:3002/diagnostic' },
    configurable: true,
  })
})

describe('diagnostic.vue — WebAuthn support checks', () => {
  it('shows all checks passed when WebAuthn, platform authenticator, and secure context are all available', async () => {
    stubWebAuthn(true)
    const wrapper = await mountPage()

    expect(wrapper.text()).toContain('All Checks Passed!')
    expect(wrapper.text()).not.toContain('Recommendations')
  })

  it('recommends a supported browser when WebAuthn is unavailable', async () => {
    clearWebAuthn()
    const wrapper = await mountPage()

    expect(wrapper.text()).toContain('Recommendations')
    expect(wrapper.text()).toContain('does not support WebAuthn')
  })

  it('recommends a hardware key when the platform authenticator check resolves false', async () => {
    stubWebAuthn(false)
    const wrapper = await mountPage()

    expect(wrapper.text()).toContain('does not have TouchID/FaceID/Windows Hello configured')
  })

  it('treats a platform authenticator check failure as unavailable, not a crash', async () => {
    stubWebAuthn('throws')
    const wrapper = await mountPage()

    expect(wrapper.text()).toContain('does not have TouchID/FaceID/Windows Hello configured')
  })

  it('recommends accessing via localhost when not in a secure context', async () => {
    stubWebAuthn(true)
    Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true })
    const wrapper = await mountPage()

    expect(wrapper.text()).toContain('NOT via IP address or 127.0.0.1')
  })
})

describe('diagnostic.vue — backend connection test', () => {
  it('shows a reachable message on success', async () => {
    stubWebAuthn(true)
    const wrapper = await mountPage()

    mockFetch.mockResolvedValueOnce({ status: 'ok' })
    await wrapper.find('button').trigger('click')
    await flushPromises()

    expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/health', { method: 'GET' })
    expect(wrapper.text()).toContain('Backend is reachable')
  })

  it('shows the error message on failure', async () => {
    stubWebAuthn(true)
    const wrapper = await mountPage()

    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'))
    await wrapper.find('button').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Cannot connect to backend')
    expect(wrapper.text()).toContain('ECONNREFUSED')
  })
})
