import { describe, it, expect, vi, beforeAll } from 'vitest'
import { mount } from '@vue/test-utils'
import TermsPage from '../../app/pages/terms.vue'

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

describe('TermsPage', () => {
  let wrapper: ReturnType<typeof mount>

  beforeAll(() => {
    wrapper = mount(TermsPage, { global: globalConfig })
  })

  // ── SEO metadata ──────────────────────────────────────────────────────────

  describe('SEO metadata', () => {
    it('calls useSeoMeta on setup', () => {
      expect(useSeoMetaMock).toHaveBeenCalled()
    })

    it('passes the correct page title', () => {
      const meta = useSeoMetaMock.mock.calls[0][0]
      expect(meta.title).toBe('Terms of Service — yourplug')
    })

    it('passes a description about Terms of Service', () => {
      const meta = useSeoMetaMock.mock.calls[0][0]
      expect(meta.description).toContain('Terms of Service')
    })

    it('passes the ogUrl containing /terms', () => {
      const meta = useSeoMetaMock.mock.calls[0][0]
      expect(meta.ogUrl).toContain('/terms')
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

    it('renders the page heading "Terms of Service"', () => {
      expect(wrapper.find('h1').text()).toContain('Terms of Service')
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

    it('back link mentions Back to Products', () => {
      const backLink = wrapper.find('main > a')
      expect(backLink.text()).toContain('Back to Products')
    })
  })

  // ── FTC Disclosure ────────────────────────────────────────────────────────

  describe('FTC Disclosure', () => {
    it('contains the FTC Affiliate Disclosure section heading', () => {
      const headings = wrapper.findAll('h2')
      const found = headings.some((h) => h.text().includes('FTC Affiliate Disclosure'))
      expect(found).toBe(true)
    })

    it('mentions affiliate commission and no additional cost', () => {
      const text = wrapper.text()
      expect(text).toContain('commission')
      expect(text).toContain('no additional cost')
    })

    it('names the affiliate retailers (DHgate, AliExpress, Amazon, Wish)', () => {
      const text = wrapper.text()
      expect(text).toContain('DHgate')
      expect(text).toContain('AliExpress')
      expect(text).toContain('Amazon')
      expect(text).toContain('Wish')
    })
  })

  // ── Required sections ─────────────────────────────────────────────────────

  describe('content sections', () => {
    it('contains "About the Site" section', () => {
      const headings = wrapper.findAll('h2')
      const found = headings.some((h) => h.text().includes('About the Site'))
      expect(found).toBe(true)
    })

    it('contains "Eligibility" section', () => {
      const headings = wrapper.findAll('h2')
      const found = headings.some((h) => h.text().includes('Eligibility'))
      expect(found).toBe(true)
    })

    it('states the 18-year age requirement', () => {
      expect(wrapper.text()).toContain('18')
    })

    it('contains "Accounts" section', () => {
      const headings = wrapper.findAll('h2')
      const found = headings.some((h) => h.text().includes('Accounts'))
      expect(found).toBe(true)
    })

    it('mentions OAuth providers', () => {
      const text = wrapper.text()
      expect(text).toContain('Google')
      expect(text).toContain('GitHub')
      expect(text).toContain('Discord')
    })

    it('contains "Prohibited Conduct" section', () => {
      const headings = wrapper.findAll('h2')
      const found = headings.some((h) => h.text().includes('Prohibited Conduct'))
      expect(found).toBe(true)
    })

    it('contains "Intellectual Property" section', () => {
      const headings = wrapper.findAll('h2')
      const found = headings.some((h) => h.text().includes('Intellectual Property'))
      expect(found).toBe(true)
    })

    it('contains "Disclaimers" and "Limitation of Liability" section', () => {
      const headings = wrapper.findAll('h2')
      const found = headings.some(
        (h) => h.text().includes('Disclaimer') || h.text().includes('Limitation of Liability')
      )
      expect(found).toBe(true)
    })

    it('mentions the $100 liability cap', () => {
      expect(wrapper.text()).toContain('$100')
    })

    it('contains "Governing Law" section', () => {
      const headings = wrapper.findAll('h2')
      const found = headings.some((h) => h.text().includes('Governing Law'))
      expect(found).toBe(true)
    })

    it('mentions Delaware as the governing jurisdiction', () => {
      expect(wrapper.text()).toContain('Delaware')
    })

    it('states the site is provided "as is"', () => {
      expect(wrapper.text().toLowerCase()).toContain('as is')
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

    it('mailto link contains an @ symbol', () => {
      const mailtoLink = wrapper
        .findAll('a')
        .find((a) => a.attributes('href')?.startsWith('mailto:'))
      expect(mailtoLink!.attributes('href')).toContain('@')
    })
  })

  // ── Cross-link to Privacy Policy ─────────────────────────────────────────

  describe('privacy policy link', () => {
    it('contains a link to /privacy', () => {
      const allLinks = wrapper.findAll('a')
      const privacyLink = allLinks.find((a) => a.attributes('href') === '/privacy')
      expect(privacyLink).toBeDefined()
    })
  })

  // ── Prohibited conduct list ───────────────────────────────────────────────

  describe('prohibited conduct list', () => {
    it('renders a <ul> list of prohibited items', () => {
      expect(wrapper.find('ul').exists()).toBe(true)
    })

    it('mentions scraping/crawling restriction', () => {
      expect(wrapper.text()).toContain('Scrape')
    })

    it('mentions impersonation restriction', () => {
      expect(wrapper.text()).toContain('Impersonate')
    })
  })
})