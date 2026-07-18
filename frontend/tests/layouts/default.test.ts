import { describe, it, expect, vi, beforeAll } from 'vitest'
import { mount } from '@vue/test-utils'
import DefaultLayout from '../../app/layouts/default.vue'

// ---------------------------------------------------------------------------
// Nuxt auto-import stubs
// ---------------------------------------------------------------------------
vi.stubGlobal('useState', (_key: string, init: () => unknown) => {
  const { ref } = require('vue')
  return ref(typeof init === 'function' ? init() : undefined)
})
vi.stubGlobal('useAuth', () => ({ user: null, signOut: vi.fn() }))
vi.stubGlobal('useDarkMode', () => ({ init: vi.fn(), toggle: vi.fn(), isDark: { value: false } }))
vi.stubGlobal('navigateTo', vi.fn())
vi.stubGlobal('useRuntimeConfig', () => ({ public: { siteUrl: 'https://example.com' } }))

// getCurrentSeason is a local util, stub at module level below

// ---------------------------------------------------------------------------
// Component stubs so the layout mounts without resolving child components
// ---------------------------------------------------------------------------
const NuxtLinkStub = {
  name: 'NuxtLink',
  template: '<a :href="to" :aria-label="ariaLabel"><slot /></a>',
  props: ['to', 'ariaLabel'],
}

const global = {
  stubs: {
    NuxtLink: NuxtLinkStub,
    SearchBar: { template: '<div />' },
    DarkModeToggle: { template: '<div />' },
    AppFeedbackToastContainer: { template: '<div />' },
  },
}

// ---------------------------------------------------------------------------
// Tests — footer legal navigation added in this PR
// ---------------------------------------------------------------------------

describe('DefaultLayout — footer legal navigation', () => {
  let wrapper: ReturnType<typeof mount>

  beforeAll(async () => {
    wrapper = mount(DefaultLayout, {
      global,
      slots: { default: '<p>page content</p>' },
    })
  })

  it('renders a footer element', () => {
    expect(wrapper.find('footer').exists()).toBe(true)
  })

  it('renders a <nav> with aria-label="Legal" inside the footer', () => {
    const nav = wrapper.find('footer nav[aria-label="Legal"]')
    expect(nav.exists()).toBe(true)
  })

  it('renders a Privacy Policy link pointing to /privacy', () => {
    const nav = wrapper.find('footer nav[aria-label="Legal"]')
    const links = nav.findAll('a')
    const privacyLink = links.find((l) => l.text().includes('Privacy Policy'))
    expect(privacyLink).toBeDefined()
    expect(privacyLink!.attributes('href')).toBe('/privacy')
  })

  it('renders a Terms of Service link pointing to /terms', () => {
    const nav = wrapper.find('footer nav[aria-label="Legal"]')
    const links = nav.findAll('a')
    const termsLink = links.find((l) => l.text().includes('Terms of Service'))
    expect(termsLink).toBeDefined()
    expect(termsLink!.attributes('href')).toBe('/terms')
  })

  it('legal nav contains exactly two links', () => {
    const nav = wrapper.find('footer nav[aria-label="Legal"]')
    expect(nav.findAll('a').length).toBe(2)
  })

  it('both legal links carry the text-xs CSS class', () => {
    const nav = wrapper.find('footer nav[aria-label="Legal"]')
    nav.findAll('a').forEach((link) => {
      expect(link.classes()).toContain('text-xs')
    })
  })

  it('footer still contains the copyright notice alongside the legal nav', () => {
    expect(wrapper.find('footer').text()).toContain('yourplug. All rights reserved.')
  })

  it('footer still contains the FTC disclosure text', () => {
    expect(wrapper.find('footer').text()).toContain('FTC Disclosure')
  })
})