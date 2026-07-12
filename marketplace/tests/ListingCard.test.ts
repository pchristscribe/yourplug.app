import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ListingCard from '../app/components/ListingCard.vue'
import type { ListingSummary } from '../app/types/listings'

const SAMPLE: ListingSummary = {
  id: '00000000-0000-0000-0000-000000000001',
  title: 'Rainbow Harness',
  condition: 'LIKE_NEW',
  category: 'HARNESS',
  askingPrice: 45.00,
  createdAt: '2026-01-01T00:00:00Z',
  sellerDisplayName: 'gayshop99',
  primaryImageUrl: null,
}

vi.mock('#app', () => ({
  useNuxtApp: () => ({}),
  navigateTo: vi.fn(),
  useRuntimeConfig: () => ({ public: { apiBase: 'http://localhost:3001' } }),
}))

describe('ListingCard', () => {
  it('renders the listing title', () => {
    const wrapper = mount(ListingCard, {
      props: { listing: SAMPLE },
      global: {
        stubs: { NuxtLink: { template: '<a><slot /></a>' } },
      },
    })
    expect(wrapper.text()).toContain('Rainbow Harness')
  })

  it('renders the asking price', () => {
    const wrapper = mount(ListingCard, {
      props: { listing: SAMPLE },
      global: {
        stubs: { NuxtLink: { template: '<a><slot /></a>' } },
      },
    })
    expect(wrapper.text()).toContain('45.00')
  })

  it('renders the condition badge', () => {
    const wrapper = mount(ListingCard, {
      props: { listing: SAMPLE },
      global: {
        stubs: { NuxtLink: { template: '<a><slot /></a>' } },
      },
    })
    expect(wrapper.text()).toContain('Like New')
  })

  it('renders the category badge', () => {
    const wrapper = mount(ListingCard, {
      props: { listing: SAMPLE },
      global: {
        stubs: { NuxtLink: { template: '<a><slot /></a>' } },
      },
    })
    expect(wrapper.text()).toContain('Harness')
  })

  it('renders seller name', () => {
    const wrapper = mount(ListingCard, {
      props: { listing: SAMPLE },
      global: {
        stubs: { NuxtLink: { template: '<a><slot /></a>' } },
      },
    })
    expect(wrapper.text()).toContain('gayshop99')
  })

  it('shows placeholder when no image', () => {
    const wrapper = mount(ListingCard, {
      props: { listing: { ...SAMPLE, primaryImageUrl: null } },
      global: {
        stubs: { NuxtLink: { template: '<a><slot /></a>' } },
      },
    })
    expect(wrapper.text()).toContain('📦')
  })

  it('renders the image when a primaryImageUrl is present', () => {
    const wrapper = mount(ListingCard, {
      props: { listing: { ...SAMPLE, primaryImageUrl: 'https://x/img.jpg' } },
      global: {
        stubs: { NuxtLink: { template: '<a><slot /></a>' } },
      },
    })
    expect(wrapper.find('img').attributes('src')).toBe('https://x/img.jpg')
  })

  it('omits the seller line when sellerDisplayName is absent', () => {
    const wrapper = mount(ListingCard, {
      props: { listing: { ...SAMPLE, sellerDisplayName: undefined } },
      global: {
        stubs: { NuxtLink: { template: '<a><slot /></a>' } },
      },
    })
    expect(wrapper.text()).not.toContain('by ')
  })

  it('falls back to the raw enum value for an unrecognized condition/category', () => {
    const wrapper = mount(ListingCard, {
      props: { listing: { ...SAMPLE, condition: 'MYSTERY' as ListingSummary['condition'], category: 'MYSTERY' as ListingSummary['category'] } },
      global: {
        stubs: { NuxtLink: { template: '<a><slot /></a>' } },
      },
    })
    expect(wrapper.text()).toContain('MYSTERY')
  })

  it('is SSR-safe: renders via the server renderer without browser globals', async () => {
    const { createSSRApp } = await import('vue')
    // vue's exported subpath — '@vue/server-renderer' is a transitive dep
    // that pnpm's strict node_modules won't resolve directly
    const { renderToString } = await import('vue/server-renderer')

    // No window/document here — renderToString runs outside the DOM, so any
    // browser-only API access at setup time would throw.
    const app = createSSRApp(ListingCard, { listing: SAMPLE })
    app.component('NuxtLink', { template: '<a><slot /></a>' })
    const html = await renderToString(app)

    expect(html).toContain('Rainbow Harness')
    expect(html).toContain('45.00')
  })
})
