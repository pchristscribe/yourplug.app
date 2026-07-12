import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ProductCard from '../../app/components/ProductCard.vue'
import type { Product } from '../../app/types'

// Mock NuxtLink component
const NuxtLinkStub = {
  name: 'NuxtLink',
  template: '<a :href="to"><slot /></a>',
  props: ['to'],
}

const mockProduct: Product = {
  id: '1',
  externalId: 'ext-123',
  platform: 'DHGATE',
  title: 'Test Product Title',
  description: 'This is a test product description',
  imageUrl: 'https://example.com/test-product.jpg',
  price: 29.99,
  currency: 'USD',
  priceUpdatedAt: '2025-01-01T00:00:00Z',
  categoryId: 'cat-1',
  category: {
    id: 'cat-1',
    name: 'Electronics',
    slug: 'electronics',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  status: 'ACTIVE',
  rating: 4.5,
  reviewCount: 123,
  tags: ['tech', 'gadget'],
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
}

describe('ProductCard', () => {
  it('should render product information correctly', () => {
    const wrapper = mount(ProductCard, {
      props: { product: mockProduct },
      global: {
        stubs: { NuxtLink: NuxtLinkStub },
      },
    })

    expect(wrapper.text()).toContain('Test Product Title')
    expect(wrapper.text()).toContain('This is a test product description')
    expect(wrapper.text()).toContain('$29.99')
    expect(wrapper.text()).toContain('DHGATE')
    expect(wrapper.text()).toContain('Electronics')
  })

  it('should display affiliate disclosure badge', () => {
    const wrapper = mount(ProductCard, {
      props: { product: mockProduct },
      global: {
        stubs: { NuxtLink: NuxtLinkStub },
      },
    })

    expect(wrapper.text()).toContain('Affiliate')
    const badge = wrapper.find('[role="note"]')
    expect(badge.exists()).toBe(true)
    expect(badge.attributes('aria-label')).toBe('Affiliate product')
  })

  it('should display product rating when available', () => {
    const wrapper = mount(ProductCard, {
      props: { product: mockProduct },
      global: {
        stubs: { NuxtLink: NuxtLinkStub },
      },
    })

    expect(wrapper.text()).toContain('4.5')
    expect(wrapper.text()).toContain('(123)')
  })

  it('should not display rating when not available', () => {
    const productWithoutRating = { ...mockProduct, rating: undefined, reviewCount: 0 }
    const wrapper = mount(ProductCard, {
      props: { product: productWithoutRating },
      global: {
        stubs: { NuxtLink: NuxtLinkStub },
      },
    })

    const ratingElement = wrapper.find('.sr-only')
    expect(ratingElement.exists()).toBe(false)
  })

  it('should render product image with correct attributes', () => {
    const wrapper = mount(ProductCard, {
      props: { product: mockProduct },
      global: {
        stubs: { NuxtLink: NuxtLinkStub },
      },
    })

    const img = wrapper.find('img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('https://example.com/test-product.jpg')
    expect(img.attributes('alt')).toBe('Test Product Title')
    expect(img.attributes('loading')).toBe('lazy')
  })

  it('should emit add-to-cart event when button is clicked', async () => {
    const wrapper = mount(ProductCard, {
      props: { product: mockProduct },
      global: {
        stubs: { NuxtLink: NuxtLinkStub },
      },
    })

    const button = wrapper.find('button[type="button"]')
    expect(button.exists()).toBe(true)
    expect(button.text()).toBe('Add to Cart')

    await button.trigger('click')

    expect(wrapper.emitted('add-to-cart')).toBeTruthy()
    expect(wrapper.emitted('add-to-cart')?.[0]).toEqual([mockProduct])
  })

  it('should have proper ARIA labels for accessibility', () => {
    const wrapper = mount(ProductCard, {
      props: { product: mockProduct },
      global: {
        stubs: { NuxtLink: NuxtLinkStub },
      },
    })

    const article = wrapper.find('article')
    expect(article.attributes('aria-label')).toBe('Product: Test Product Title')

    const button = wrapper.find('button')
    expect(button.attributes('aria-label')).toBe('Add Test Product Title to cart')
  })

  it('should link to product detail page', () => {
    const wrapper = mount(ProductCard, {
      props: { product: mockProduct },
      global: {
        stubs: { NuxtLink: NuxtLinkStub },
      },
    })

    const link = wrapper.find('a')
    expect(link.attributes('href')).toBe('/products/1')
  })

  it('should apply brand token styling classes', () => {
    const wrapper = mount(ProductCard, {
      props: { product: mockProduct },
      global: {
        stubs: { NuxtLink: NuxtLinkStub },
      },
    })

    const article = wrapper.find('article')
    // Verify migration from indigo-*/gray-* defaults to named brand tokens
    expect(article.classes()).toContain('bg-surface')
    expect(article.classes()).toContain('rounded-card')
    expect(article.classes()).toContain('shadow-card')
    expect(article.classes()).toContain('hover:shadow-raised')
    expect(article.classes()).not.toContain('bg-white')
    expect(article.classes()).not.toContain('rounded-lg')
  })
})
