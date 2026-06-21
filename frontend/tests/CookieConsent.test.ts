import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'

// ── localStorage stub ────────────────────────────────────────────────────────
const _lsStore: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (k: string) => _lsStore[k] ?? null,
  setItem: (k: string, v: string) => { _lsStore[k] = v },
  removeItem: (k: string) => { delete _lsStore[k] },
  clear: () => { for (const k in _lsStore) delete _lsStore[k] },
})

// ── document.cookie stub ─────────────────────────────────────────────────────
let _cookieJar = ''
Object.defineProperty(document, 'cookie', {
  get: () => _cookieJar,
  set: (v: string) => { _cookieJar = v },
  configurable: true,
})

// ── Nuxt auto-import stubs ───────────────────────────────────────────────────
vi.stubGlobal('ref', (await import('vue')).ref)
vi.stubGlobal('onMounted', (await import('vue')).onMounted)
vi.stubGlobal('watch', (await import('vue')).watch)
vi.stubGlobal('nextTick', (await import('vue')).nextTick)

const NuxtLinkStub = { template: '<a :href="to"><slot /></a>', props: ['to'] }
const global = { stubs: { NuxtLink: NuxtLinkStub } }

import CookieConsent from '../app/components/CookieConsent.vue'

describe('CookieConsent', () => {
  beforeEach(() => {
    localStorage.clear()
    _cookieJar = ''
    vi.clearAllMocks()
  })

  // ── Visibility ─────────────────────────────────────────────────────────────

  describe('visibility', () => {
    it('banner is hidden when localStorage.cookieConsent is "accepted"', async () => {
      localStorage.setItem('cookieConsent', 'accepted')
      const wrapper = mount(CookieConsent, { global })
      // onMounted fires synchronously in happy-dom
      await wrapper.vm.$nextTick()
      expect(wrapper.find('[role="region"]').exists()).toBe(false)
    })

    it('banner is hidden when localStorage.cookieConsent is "declined"', async () => {
      localStorage.setItem('cookieConsent', 'declined')
      const wrapper = mount(CookieConsent, { global })
      await wrapper.vm.$nextTick()
      expect(wrapper.find('[role="region"]').exists()).toBe(false)
    })

    it('banner is visible when cookieConsent key is absent', async () => {
      const wrapper = mount(CookieConsent, { global })
      await wrapper.vm.$nextTick()
      expect(wrapper.find('[role="region"]').exists()).toBe(true)
    })

    it('banner is visible when cookieConsent is set to an unrecognised value', async () => {
      localStorage.setItem('cookieConsent', 'something-else')
      const wrapper = mount(CookieConsent, { global })
      await wrapper.vm.$nextTick()
      expect(wrapper.find('[role="region"]').exists()).toBe(true)
    })
  })

  // ── Accept All ─────────────────────────────────────────────────────────────

  describe('acceptAll()', () => {
    it('sets localStorage to "accepted" when Accept All is clicked', async () => {
      const wrapper = mount(CookieConsent, { global })
      await wrapper.vm.$nextTick()
      const btn = wrapper.findAll('button').find(b => b.text() === 'Accept All')
      await btn?.trigger('click')
      expect(localStorage.getItem('cookieConsent')).toBe('accepted')
    })

    it('hides the banner after Accept All is clicked', async () => {
      const wrapper = mount(CookieConsent, { global })
      await wrapper.vm.$nextTick()
      const btn = wrapper.findAll('button').find(b => b.text() === 'Accept All')
      await btn?.trigger('click')
      await wrapper.vm.$nextTick()
      expect(wrapper.find('[role="region"]').exists()).toBe(false)
    })

    it('sets analytics_consent cookie with Secure flag on accept', async () => {
      const wrapper = mount(CookieConsent, { global })
      await wrapper.vm.$nextTick()
      const btn = wrapper.findAll('button').find(b => b.text() === 'Accept All')
      await btn?.trigger('click')
      expect(_cookieJar).toContain('analytics_consent=true')
      expect(_cookieJar).toContain('Secure')
    })
  })

  // ── Decline ────────────────────────────────────────────────────────────────

  describe('decline()', () => {
    it('sets localStorage to "declined" when Decline is clicked', async () => {
      const wrapper = mount(CookieConsent, { global })
      await wrapper.vm.$nextTick()
      const btn = wrapper.findAll('button').find(b => b.text() === 'Decline')
      await btn?.trigger('click')
      expect(localStorage.getItem('cookieConsent')).toBe('declined')
    })

    it('hides the banner after Decline is clicked', async () => {
      const wrapper = mount(CookieConsent, { global })
      await wrapper.vm.$nextTick()
      const btn = wrapper.findAll('button').find(b => b.text() === 'Decline')
      await btn?.trigger('click')
      await wrapper.vm.$nextTick()
      expect(wrapper.find('[role="region"]').exists()).toBe(false)
    })

    it('expires the analytics_consent cookie with Secure flag on decline', async () => {
      const wrapper = mount(CookieConsent, { global })
      await wrapper.vm.$nextTick()
      const btn = wrapper.findAll('button').find(b => b.text() === 'Decline')
      await btn?.trigger('click')
      expect(_cookieJar).toContain('max-age=0')
      expect(_cookieJar).toContain('Secure')
    })

    it('does not set analytics_consent=false as a string on decline', async () => {
      const wrapper = mount(CookieConsent, { global })
      await wrapper.vm.$nextTick()
      const btn = wrapper.findAll('button').find(b => b.text() === 'Decline')
      await btn?.trigger('click')
      expect(_cookieJar).not.toContain('analytics_consent=false')
    })
  })

  // ── Accessibility ──────────────────────────────────────────────────────────

  describe('accessibility', () => {
    it('root element has role="region"', async () => {
      const wrapper = mount(CookieConsent, { global })
      await wrapper.vm.$nextTick()
      expect(wrapper.find('[role="region"]').exists()).toBe(true)
    })

    it('root element has aria-label="Cookie consent"', async () => {
      const wrapper = mount(CookieConsent, { global })
      await wrapper.vm.$nextTick()
      expect(wrapper.find('[role="region"]').attributes('aria-label')).toBe('Cookie consent')
    })

    it('root element has aria-describedby="cookie-consent-desc"', async () => {
      const wrapper = mount(CookieConsent, { global })
      await wrapper.vm.$nextTick()
      expect(wrapper.find('[role="region"]').attributes('aria-describedby')).toBe('cookie-consent-desc')
    })

    it('description paragraph has id="cookie-consent-desc"', async () => {
      const wrapper = mount(CookieConsent, { global })
      await wrapper.vm.$nextTick()
      expect(wrapper.find('#cookie-consent-desc').exists()).toBe(true)
    })

    it('does not have role="dialog"', async () => {
      const wrapper = mount(CookieConsent, { global })
      await wrapper.vm.$nextTick()
      expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    })

    it('Decline button label is "Decline" (not "Manage / Decline")', async () => {
      const wrapper = mount(CookieConsent, { global })
      await wrapper.vm.$nextTick()
      const buttons = wrapper.findAll('button')
      expect(buttons.some(b => b.text() === 'Manage / Decline')).toBe(false)
      expect(buttons.some(b => b.text() === 'Decline')).toBe(true)
    })
  })
})
