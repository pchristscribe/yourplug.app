/**
 * Page tests for login.vue — this page previously had zero direct coverage
 * (auth.test.ts covers the auth store's WebAuthn/password logic in
 * isolation, stubbing useRateLimit as a global). login.vue itself is thin —
 * it delegates to the auth store's actions — so these tests stub
 * useAuthStore() as a reactive mock and assert on the page's own wiring
 * (which store action fires for which mode, navigation-on-success,
 * error display, loading state) rather than re-testing WebAuthn internals
 * that already have coverage in the store's own test file.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, computed, onMounted, reactive } from 'vue'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)
vi.stubGlobal('onMounted', onMounted)
vi.stubGlobal('definePageMeta', vi.fn())

const mockNavigateTo = vi.fn()
vi.stubGlobal('navigateTo', mockNavigateTo)

const mockAlert = vi.fn()
vi.stubGlobal('alert', mockAlert)

const mockAuthStore = reactive({
  loading: false,
  error: null as string | null,
  loginWithPassword: vi.fn(),
  loginWithSecurityKey: vi.fn(),
  registerSecurityKey: vi.fn(),
})
vi.stubGlobal('useAuthStore', () => mockAuthStore)

const LoginPage = (await import('../app/pages/login.vue')).default

function mountPage() {
  return mount(LoginPage)
}

beforeEach(() => {
  mockNavigateTo.mockReset()
  mockAlert.mockReset()
  mockAuthStore.loading = false
  mockAuthStore.error = null
  mockAuthStore.loginWithPassword = vi.fn()
  mockAuthStore.loginWithSecurityKey = vi.fn()
  mockAuthStore.registerSecurityKey = vi.fn()
})

describe('login.vue — default (security key) mode', () => {
  it('does not show the password field by default', () => {
    const wrapper = mountPage()
    expect(wrapper.find('#password').exists()).toBe(false)
    expect(wrapper.text()).toContain('Sign in with Security Key')
  })

  it('submitting calls loginWithSecurityKey and navigates home on success', async () => {
    mockAuthStore.loginWithSecurityKey.mockResolvedValue(true)
    const wrapper = mountPage()

    await wrapper.find('#email').setValue('admin@yourplug.app')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(mockAuthStore.loginWithSecurityKey).toHaveBeenCalledWith('admin@yourplug.app')
    expect(mockAuthStore.loginWithPassword).not.toHaveBeenCalled()
    expect(mockNavigateTo).toHaveBeenCalledWith('/')
  })

  it('does not navigate when loginWithSecurityKey fails', async () => {
    mockAuthStore.loginWithSecurityKey.mockResolvedValue(false)
    const wrapper = mountPage()

    await wrapper.find('#email').setValue('admin@yourplug.app')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(mockNavigateTo).not.toHaveBeenCalled()
  })

  it('shows the auth store error message when present', () => {
    mockAuthStore.error = 'Security key not recognized'
    const wrapper = mountPage()
    expect(wrapper.text()).toContain('Security key not recognized')
  })

  it('disables the submit button and shows Authenticating… while loading', () => {
    mockAuthStore.loading = true
    const wrapper = mountPage()
    expect(wrapper.text()).toContain('Authenticating...')
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined()
  })
})

describe('login.vue — password mode toggle', () => {
  it('reveals the password field and clears the store error on toggle', async () => {
    mockAuthStore.error = 'Previous failure'
    const wrapper = mountPage()

    await wrapper.find('button[aria-pressed]').trigger('click')

    expect(wrapper.find('#password').exists()).toBe(true)
    expect(mockAuthStore.error).toBeNull()
  })

  it('submitting in password mode calls loginWithPassword with email and password', async () => {
    mockAuthStore.loginWithPassword.mockResolvedValue(true)
    const wrapper = mountPage()

    await wrapper.find('button[aria-pressed]').trigger('click')
    await wrapper.find('#email').setValue('admin@yourplug.app')
    await wrapper.find('#password').setValue('hunter2')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(mockAuthStore.loginWithPassword).toHaveBeenCalledWith('admin@yourplug.app', 'hunter2')
    expect(mockAuthStore.loginWithSecurityKey).not.toHaveBeenCalled()
  })

  it('clears the password field when toggling back to security-key mode', async () => {
    const wrapper = mountPage()

    await wrapper.find('button[aria-pressed]').trigger('click') // -> password mode
    await wrapper.find('#password').setValue('hunter2')
    await wrapper.find('button[aria-pressed]').trigger('click') // -> back to security key

    expect(wrapper.find('#password').exists()).toBe(false)
    // Toggling forward again should show an empty field, not the stale value
    await wrapper.find('button[aria-pressed]').trigger('click')
    expect((wrapper.find('#password').element as HTMLInputElement).value).toBe('')
  })
})

describe('login.vue — register flow', () => {
  it('switches to the register tab and back', async () => {
    const wrapper = mountPage()

    await wrapper.find('button').trigger('click') // first button isn't the register CTA; find by text instead
    const registerCta = wrapper.findAll('button').find(b => b.text() === 'Register Security Key')
    await registerCta?.trigger('click')

    expect(wrapper.text()).toContain('Device name (optional)')

    const backButton = wrapper.findAll('button').find(b => b.text().includes('Back to login'))
    await backButton?.trigger('click')
    expect(wrapper.text()).not.toContain('Device name (optional)')
  })

  it('registerSecurityKey success hides the register tab, clears error, and alerts', async () => {
    mockAuthStore.registerSecurityKey.mockResolvedValue(true)
    const wrapper = mountPage()

    const registerCta = wrapper.findAll('button').find(b => b.text() === 'Register Security Key')
    await registerCta?.trigger('click')

    await wrapper.find('#reg-email').setValue('newadmin@yourplug.app')
    await wrapper.find('#device-name').setValue('YubiKey 5')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(mockAuthStore.registerSecurityKey).toHaveBeenCalledWith('newadmin@yourplug.app', 'YubiKey 5')
    expect(mockAlert).toHaveBeenCalledWith('Security key registered! You can now sign in.')
    expect(wrapper.text()).not.toContain('Device name (optional)')
  })

  it('passes undefined device name when left blank', async () => {
    mockAuthStore.registerSecurityKey.mockResolvedValue(true)
    const wrapper = mountPage()

    const registerCta = wrapper.findAll('button').find(b => b.text() === 'Register Security Key')
    await registerCta?.trigger('click')
    await wrapper.find('#reg-email').setValue('newadmin@yourplug.app')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(mockAuthStore.registerSecurityKey).toHaveBeenCalledWith('newadmin@yourplug.app', undefined)
  })

  it('stays on the register tab when registration fails', async () => {
    mockAuthStore.registerSecurityKey.mockResolvedValue(false)
    const wrapper = mountPage()

    const registerCta = wrapper.findAll('button').find(b => b.text() === 'Register Security Key')
    await registerCta?.trigger('click')
    await wrapper.find('#reg-email').setValue('newadmin@yourplug.app')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(mockAlert).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Device name (optional)')
  })
})
