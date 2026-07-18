import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ProductCard from '../app/components/ProductCard.vue'
import type { Product } from '../app/types'

const NuxtLinkStub = { template: '<a :href="to"><slot /></a>', props: ['to'] }
const global = { stubs: { NuxtLink: NuxtLinkStub } }

const mockProduct: Product = {
  id: 'product-1',
  externalId: 'ext-123',
  platform: 'DHGATE',
  title: 'Rainbow Pride Flag',
  description: 'Large rainbow pride flag for celebrations',
  imageUrl: 'https://example.com/flag.jpg',
  price: 12.99,
  currency: 'USD',
  priceUpdatedAt: '2024-01-01T00:00:00Z',
  categoryId: 'cat-1',
  status: 'ACTIVE',
  rating: 4.5,
  reviewCount: 120,
  tags: ['pride', 'flag'],
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
}

const mockProductWithDiscount: Product = {
  ...mockProduct,
  id: 'product-2',
  price: 9.99,
  originalPrice: 19.99,
}

const mockProductWithCategory: Product = {
  ...mockProduct,
  category: {
    id: 'cat-1',
    name: 'Electronics',
    slug: 'electronics',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
}

describe('ProductCard Component', () => {
  describe('Rendering', () => {
    it('renders product image with correct src and alt', () => {
      const wrapper = mount(ProductCard, { props: { product: mockProduct }, global })
      const img = wrapper.find('img')
      expect(img.exists()).toBe(true)
      expect(img.attributes('src')).toBe(mockProduct.imageUrl)
      expect(img.attributes('alt')).toBe(mockProduct.title)
    })

    it('renders product title', () => {
      const wrapper = mount(ProductCard, { props: { product: mockProduct }, global })
      const title = wrapper.find('h3')
      expect(title.exists()).toBe(true)
      expect(title.text()).toBe(mockProduct.title)
    })

    it('renders product price with dollar sign', () => {
      const wrapper = mount(ProductCard, { props: { product: mockProduct }, global })
      const price = wrapper.find('[aria-label^="Price:"]')
      expect(price.exists()).toBe(true)
      expect(price.text()).toBe('$12.99')
    })

    it('renders Add to Cart button', () => {
      const wrapper = mount(ProductCard, { props: { product: mockProduct }, global })
      const buttons = wrapper.findAll('button')
      expect(buttons.some(b => b.text() === 'Add to Cart')).toBe(true)
    })

    it('renders View Details button in full variant', () => {
      const wrapper = mount(ProductCard, { props: { product: mockProduct }, global })
      const buttons = wrapper.findAll('button')
      expect(buttons.some(b => b.text() === 'View Details')).toBe(true)
    })

    it('does not render discount when showDiscount is false', () => {
      const wrapper = mount(ProductCard, {
        props: { product: mockProductWithDiscount, showDiscount: false },
        global,
      })
      expect(wrapper.find('[aria-label$="% discount"]').exists()).toBe(false)
    })

    it('does not render discount when showDiscount is true but no originalPrice', () => {
      const wrapper = mount(ProductCard, {
        props: { product: mockProduct, showDiscount: true },
        global,
      })
      expect(wrapper.find('[aria-label$="% discount"]').exists()).toBe(false)
    })

    it('renders discount when showDiscount is true and originalPrice exists', () => {
      const wrapper = mount(ProductCard, {
        props: { product: mockProductWithDiscount, showDiscount: true },
        global,
      })
      const discount = wrapper.find('[aria-label$="% discount"]')
      expect(discount.exists()).toBe(true)
      expect(discount.text()).toBe('50% OFF')
    })

    it('renders the category name when the product has a category', () => {
      const wrapper = mount(ProductCard, { props: { product: mockProductWithCategory }, global })
      expect(wrapper.text()).toContain('Electronics')
    })

    it('links to the product detail page', () => {
      const wrapper = mount(ProductCard, { props: { product: mockProduct }, global })
      expect(wrapper.find('a').attributes('href')).toBe(`/products/${mockProduct.id}`)
    })
  })

  // ─── Rating display ───────────────────────────────────────────────────────

  describe('Rating display', () => {
    it('shows the rating and review count when both are present', () => {
      const wrapper = mount(ProductCard, { props: { product: mockProduct }, global })
      expect(wrapper.text()).toContain('4.5')
      expect(wrapper.text()).toContain(`(${mockProduct.reviewCount})`)
    })

    it('does not show a rating when reviewCount is 0', () => {
      const wrapper = mount(ProductCard, {
        props: { product: { ...mockProduct, rating: undefined, reviewCount: 0 } },
        global,
      })
      expect(wrapper.find('.sr-only').exists()).toBe(false)
    })
  })

  // ─── Variant prop ──────────────────────────────────────────────────────────

  describe('variant prop', () => {
    it('full variant (default) renders affiliate badge', () => {
      const wrapper = mount(ProductCard, { props: { product: mockProduct }, global })
      expect(wrapper.find('[role="note"]').exists()).toBe(true)
      expect(wrapper.find('[aria-label="Affiliate product"]').exists()).toBe(true)
    })

    it('simple variant does not render affiliate badge', () => {
      const wrapper = mount(ProductCard, {
        props: { product: mockProduct, variant: 'simple' },
        global,
      })
      expect(wrapper.find('[aria-label="Affiliate product"]').exists()).toBe(false)
    })

    it('full variant renders View Details button', () => {
      const wrapper = mount(ProductCard, { props: { product: mockProduct }, global })
      expect(wrapper.findAll('button').some(b => b.text() === 'View Details')).toBe(true)
    })

    it('simple variant does not render View Details button', () => {
      const wrapper = mount(ProductCard, {
        props: { product: mockProduct, variant: 'simple' },
        global,
      })
      expect(wrapper.findAll('button').some(b => b.text() === 'View Details')).toBe(false)
    })

    it('simple variant renders exactly one action button', () => {
      const wrapper = mount(ProductCard, {
        props: { product: mockProduct, variant: 'simple' },
        global,
      })
      expect(wrapper.findAll('button')).toHaveLength(1)
      expect(wrapper.find('button').text()).toBe('Add to Cart')
    })

    it('simple variant still shows discount badge when showDiscount is true', () => {
      const wrapper = mount(ProductCard, {
        props: { product: mockProductWithDiscount, showDiscount: true, variant: 'simple' },
        global,
      })
      expect(wrapper.find('[aria-label$="% discount"]').exists()).toBe(true)
    })

    it('simple variant does not render product description', () => {
      const wrapper = mount(ProductCard, {
        props: { product: mockProduct, variant: 'simple' },
        global,
      })
      expect(wrapper.text()).not.toContain(mockProduct.description)
    })

    it('simple variant image is shorter than full variant', () => {
      const full = mount(ProductCard, { props: { product: mockProduct }, global })
      const simple = mount(ProductCard, {
        props: { product: mockProduct, variant: 'simple' },
        global,
      })
      expect(full.find('img').classes()).toContain('h-48')
      expect(simple.find('img').classes()).toContain('h-36')
    })
  })

  // ─── Discount Calculation ─────────────────────────────────────────────────

  describe('Discount Calculation', () => {
    it('calculates discount percentage correctly for 50% off', () => {
      const wrapper = mount(ProductCard, {
        props: { product: mockProductWithDiscount, showDiscount: true },
        global,
      })
      expect(wrapper.find('[aria-label$="% discount"]').text()).toBe('50% OFF')
    })

    it('calculates discount percentage correctly for 25% off', () => {
      const wrapper = mount(ProductCard, {
        props: { product: { ...mockProduct, price: 15.0, originalPrice: 20.0 }, showDiscount: true },
        global,
      })
      expect(wrapper.find('[aria-label$="% discount"]').text()).toBe('25% OFF')
    })

    it('rounds discount percentage correctly', () => {
      const wrapper = mount(ProductCard, {
        props: { product: { ...mockProduct, price: 16.67, originalPrice: 20.0 }, showDiscount: true },
        global,
      })
      // (20 - 16.67) / 20 = 16.65% → rounds to 17%
      expect(wrapper.find('[aria-label$="% discount"]').text()).toBe('17% OFF')
    })

    it('does not show discount when discountPercentage is 0', () => {
      const wrapper = mount(ProductCard, {
        props: { product: { ...mockProduct, price: 20.0, originalPrice: 20.0 }, showDiscount: true },
        global,
      })
      expect(wrapper.find('[aria-label$="% discount"]').exists()).toBe(false)
    })

    it('handles negative discount (price higher than originalPrice)', () => {
      const wrapper = mount(ProductCard, {
        props: { product: { ...mockProduct, price: 25.0, originalPrice: 20.0 }, showDiscount: true },
        global,
      })
      expect(wrapper.find('[aria-label$="% discount"]').text()).toBe('-25% OFF')
    })

    it('does not show discount for very small percentages that round to 0', () => {
      const wrapper = mount(ProductCard, {
        props: { product: { ...mockProduct, price: 19.99, originalPrice: 20.0 }, showDiscount: true },
        global,
      })
      expect(wrapper.find('[aria-label$="% discount"]').exists()).toBe(false)
    })
  })

  // ─── Event Emissions ──────────────────────────────────────────────────────

  describe('Event Emissions', () => {
    it('emits add-to-cart when Add to Cart button is clicked', async () => {
      const wrapper = mount(ProductCard, { props: { product: mockProduct }, global })
      const btn = wrapper.findAll('button').find(b => b.text() === 'Add to Cart')
      await btn?.trigger('click')
      expect(wrapper.emitted('add-to-cart')?.[0]).toEqual([mockProduct])
    })

    it('emits view-details when View Details button is clicked', async () => {
      const wrapper = mount(ProductCard, { props: { product: mockProduct }, global })
      const btn = wrapper.findAll('button').find(b => b.text() === 'View Details')
      await btn?.trigger('click')
      expect(wrapper.emitted('view-details')?.[0]).toEqual([mockProduct.id])
    })

    it('emits add-to-cart from simple variant', async () => {
      const wrapper = mount(ProductCard, {
        props: { product: mockProduct, variant: 'simple' },
        global,
      })
      await wrapper.find('button').trigger('click')
      expect(wrapper.emitted('add-to-cart')?.[0]).toEqual([mockProduct])
    })

    it('emits multiple add-to-cart events on repeated clicks', async () => {
      const wrapper = mount(ProductCard, { props: { product: mockProduct }, global })
      const btn = wrapper.findAll('button').find(b => b.text() === 'Add to Cart')
      await btn?.trigger('click')
      await btn?.trigger('click')
      await btn?.trigger('click')
      expect(wrapper.emitted('add-to-cart')).toHaveLength(3)
    })
  })

  // ─── Accessibility ────────────────────────────────────────────────────────

  describe('Accessibility', () => {
    it('article has aria-label with product title', () => {
      const wrapper = mount(ProductCard, { props: { product: mockProduct }, global })
      expect(wrapper.find('article').attributes('aria-label')).toBe(`Product: ${mockProduct.title}`)
    })

    it('Add to Cart button has descriptive aria-label', () => {
      const wrapper = mount(ProductCard, { props: { product: mockProduct }, global })
      const btn = wrapper.findAll('button').find(b => b.text() === 'Add to Cart')
      expect(btn?.attributes('aria-label')).toContain(mockProduct.title)
    })

    it('image has non-empty alt attribute', () => {
      const wrapper = mount(ProductCard, { props: { product: mockProduct }, global })
      expect(wrapper.find('img').attributes('alt')).toBeTruthy()
    })

    it('image has lazy loading attribute', () => {
      const wrapper = mount(ProductCard, { props: { product: mockProduct }, global })
      expect(wrapper.find('img').attributes('loading')).toBe('lazy')
    })
  })

  // ─── Brand tokens ─────────────────────────────────────────────────────────

  describe('Brand tokens', () => {
    it('article uses bg-surface token (not bg-white)', () => {
      const wrapper = mount(ProductCard, { props: { product: mockProduct }, global })
      expect(wrapper.find('article').classes()).toContain('bg-surface')
      expect(wrapper.find('article').classes()).not.toContain('bg-white')
    })

    it('article uses rounded-card token', () => {
      const wrapper = mount(ProductCard, { props: { product: mockProduct }, global })
      expect(wrapper.find('article').classes()).toContain('rounded-card')
    })

    it('article uses shadow-card and hover:shadow-raised tokens, not the old defaults', () => {
      const wrapper = mount(ProductCard, { props: { product: mockProduct }, global })
      const classes = wrapper.find('article').classes()
      expect(classes).toContain('shadow-card')
      expect(classes).toContain('hover:shadow-raised')
      expect(classes).not.toContain('rounded-lg')
    })

    it('Add to Cart button uses bg-brand', () => {
      const wrapper = mount(ProductCard, { props: { product: mockProduct }, global })
      const btn = wrapper.findAll('button').find(b => b.text() === 'Add to Cart')
      expect(btn?.classes()).toContain('bg-brand')
    })

    it('affiliate badge uses bg-accent (Skin Tone)', () => {
      const wrapper = mount(ProductCard, { props: { product: mockProduct }, global })
      expect(wrapper.find('[role="note"]').classes()).toContain('bg-accent')
    })
  })

  // ─── Reactivity ───────────────────────────────────────────────────────────

  describe('Reactivity', () => {
    it('updates when product prop changes', async () => {
      const wrapper = mount(ProductCard, { props: { product: mockProduct }, global })
      expect(wrapper.find('h3').text()).toBe(mockProduct.title)

      await wrapper.setProps({ product: { ...mockProduct, title: 'New Title', price: 25.99 } })

      expect(wrapper.find('h3').text()).toBe('New Title')
      expect(wrapper.find('[aria-label^="Price:"]').text()).toBe('$25.99')
    })

    it('shows discount badge when showDiscount changes to true', async () => {
      const wrapper = mount(ProductCard, {
        props: { product: mockProductWithDiscount, showDiscount: false },
        global,
      })
      expect(wrapper.find('[aria-label$="% discount"]').exists()).toBe(false)
      await wrapper.setProps({ showDiscount: true })
      expect(wrapper.find('[aria-label$="% discount"]').text()).toBe('50% OFF')
    })
  })
})
