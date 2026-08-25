import { describe, it, expect, vi, beforeAll } from 'vitest'
import { mount } from '@vue/test-utils'
import PrivacyPage from '../../app/pages/privacy.vue'

// ---------------------------------------------------------------------------
// Nuxt auto-import stubs
// ---------------------------------------------------------------------------
const useSeoMetaMock = vi.fn()
vi.stubGlobal('useSeoMeta', useSeoMetaMock)
vi.stubGlobal('useRuntimeConfig', () => ({
  public: { siteUrl: 'https://yourplug.com' },
}))

// ---------------------------------------------------------------------------
// Component stubs
// ---------------------------------------------------------------------------
const NuxtLinkStub = {
  name: 'NuxtLink',
  template: '<a :href="to"><slot /></a>',
  props: ['to'],
}

const globalConfig = {
  stubs: { NuxtLink: NuxtLinkStub },
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PrivacyPage', () => {
  let wrapper: ReturnType<typeof mount>

  beforeAll(() => {
    wrapper = mount(PrivacyPage, { global: globalConfig })
  })

  // ── SEO metadata ──────────────────────────────────────────────────────────

  describe('SEO metadata', () => {
    it('calls useSeoMeta on setup', () => {
      expect(useSeoMetaMock).toHaveBeenCalled()
    })

    it('passes the correct page title', () => {
      const meta = useSeoMetaMock.mock.calls[0][0]
      expect(meta.title).toBe('Privacy Policy — yourplug')
    })

    it('passes the correct description', () => {
      const meta = useSeoMetaMock.mock.calls[0][0]
      expect(meta.description).toContain('collects')
    })

    it('passes the ogUrl containing /privacy', () => {
      const meta = useSeoMetaMock.mock.calls[0][0]
      expect(meta.ogUrl).toContain('/privacy')
    })

    it('passes matching ogTitle and title', () => {
      const meta = useSeoMetaMock.mock.calls[0][0]
      expect(meta.ogTitle).toBe(meta.title)
    })
  })

  // ── Page structure ────────────────────────────────────────────────────────

  describe('page structure', () => {
    it('renders a <main> element', () => {
      expect(wrapper.find('main').exists()).toBe(true)
    })

    it('renders an <article> element inside main', () => {
      expect(wrapper.find('main article').exists()).toBe(true)
    })

    it('renders the page heading "Privacy Policy"', () => {
      expect(wrapper.find('h1').text()).toContain('Privacy Policy')
    })

    it('shows the effective date', () => {
      expect(wrapper.text()).toContain('Effective date')
    })
  })

  // ── Back link ─────────────────────────────────────────────────────────────

  describe('back link', () => {
    it('renders a back link to the homepage', () => {
      const backLink = wrapper.find('main > a')
      expect(backLink.exists()).toBe(true)
      expect(backLink.attributes('href')).toBe('/')
    })

    it('back link text mentions Back to Products', () => {
      const backLink = wrapper.find('main > a')
      expect(backLink.text()).toContain('Back to Products')
    })
  })

  // ── Required sections ─────────────────────────────────────────────────────

  describe('content sections', () => {
    it('contains a "Data We Collect" section heading', () => {
      const headings = wrapper.findAll('h2')
      const found = headings.some((h) => h.text().includes('Data We Collect'))
      expect(found).toBe(true)
    })

    it('contains a "Why We Collect It" section heading', () => {
      const headings = wrapper.findAll('h2')
      const found = headings.some((h) => h.text().includes('Why We Collect It'))
      expect(found).toBe(true)
    })

    it('contains a "Third-Party Services" section heading', () => {
      const headings = wrapper.findAll('h2')
      const found = headings.some((h) => h.text().includes('Third-Party Services'))
      expect(found).toBe(true)
    })

    it('contains a "Your Rights" section heading', () => {
      const headings = wrapper.findAll('h2')
      const found = headings.some((h) => h.text().includes('Your Rights'))
      expect(found).toBe(true)
    })

    it('contains CCPA section', () => {
      expect(wrapper.text()).toContain('CCPA')
    })

    it('contains GDPR section', () => {
      expect(wrapper.text()).toContain('GDPR')
    })

    it('mentions cookie details', () => {
      const headings = wrapper.findAll('h2')
      const found = headings.some((h) => h.text().includes('Cookie'))
      expect(found).toBe(true)
    })

    it('mentions IP anonymisation / hashing', () => {
      expect(wrapper.text()).toContain('hash')
    })

    it('states that raw IP addresses are not stored', () => {
      expect(wrapper.text()).toContain('never store your raw IP')
    })

    it('lists OAuth providers (Google, GitHub, Discord)', () => {
      const text = wrapper.text()
      expect(text).toContain('Google')
      expect(text).toContain('GitHub')
      expect(text).toContain('Discord')
    })

    it('does not claim to sell personal information', () => {
      expect(wrapper.text()).toContain('do not sell personal information')
    })
  })

  // ── Contact email ─────────────────────────────────────────────────────────

  describe('contact information', () => {
    it('renders at least one mailto link', () => {
      const mailtoLinks = wrapper
        .findAll('a')
        .filter((a) => a.attributes('href')?.startsWith('mailto:'))
      expect(mailtoLinks.length).toBeGreaterThan(0)
    })

    it('mailto link points to the correct contact email', () => {
      const mailtoLinks = wrapper
        .findAll('a')
        .filter((a) => a.attributes('href')?.startsWith('mailto:'))
      expect(mailtoLinks[0].attributes('href')).toContain('@')
    })
  })

  // ── Cross-link to Terms of Service ────────────────────────────────────────

  describe('terms link', () => {
    it('contains a link to /terms', () => {
      const allLinks = wrapper.findAll('a')
      const termsLink = allLinks.find((a) => a.attributes('href') === '/terms')
      expect(termsLink).toBeDefined()
    })
  })

  // ── Third-party services table ────────────────────────────────────────────

  describe('third-party services table', () => {
    it('renders at least one <table>', () => {
      expect(wrapper.find('table').exists()).toBe(true)
    })

    it('table mentions Supabase', () => {
      expect(wrapper.find('table').text()).toContain('Supabase')
    })

    it('table mentions Sentry', () => {
      expect(wrapper.find('table').text()).toContain('Sentry')
    })

    it('table mentions Dub.co', () => {
      expect(wrapper.find('table').text()).toContain('Dub.co')
    })
  })
})