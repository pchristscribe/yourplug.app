# ProductCard Component

A reusable product card component for displaying product information in the Swordfighters App.

## Features

- Product image with lazy loading
- Affiliate disclosure badge (FTC compliant)
- Platform identifier (DHgate, AliExpress, Amazon, Wish)
- Price display
- Product rating and review count
- Add to cart functionality
- Responsive design with Tailwind CSS
- Full accessibility support (ARIA labels, semantic HTML)

## Usage

```vue
<script setup lang="ts">
import ProductCard from '~/components/ProductCard.vue'
import type { Product } from '~/types'

const product: Product = {
  id: '123',
  externalId: 'ext-456',
  platform: 'DHGATE',
  title: 'Stylish Sunglasses',
  description: 'High-quality sunglasses with UV protection',
  imageUrl: 'https://example.com/sunglasses.jpg',
  price: 24.99,
  currency: 'USD',
  priceUpdatedAt: '2025-01-12T00:00:00Z',
  categoryId: 'cat-123',
  category: {
    id: 'cat-123',
    name: 'Accessories',
    slug: 'accessories',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  status: 'ACTIVE',
  rating: 4.5,
  reviewCount: 120,
  tags: ['fashion', 'sunglasses'],
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-12T00:00:00Z',
}

const handleAddToCart = (product: Product) => {
  console.log('Adding to cart:', product)
  // Implement your cart logic here
}
</script>

<template>
  <ProductCard :product="product" @add-to-cart="handleAddToCart" />
</template>
```

## Usage in Product Grid

```vue
<script setup lang="ts">
import ProductCard from '~/components/ProductCard.vue'
import type { Product } from '~/types'

const productStore = useProductStore()

const handleAddToCart = (product: Product) => {
  // Add to cart logic
  console.log('Adding to cart:', product)
}
</script>

<template>
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
    <ProductCard
      v-for="product in productStore.products"
      :key="product.id"
      :product="product"
      @add-to-cart="handleAddToCart"
    />
  </div>
</template>
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| product | Product | Yes | Product object containing all product information |

## Events

| Event | Payload | Description |
|-------|---------|-------------|
| add-to-cart | Product | Emitted when the "Add to Cart" button is clicked |

## Accessibility

The component includes:
- Semantic HTML (`<article>`, `<h3>`, `<button>`)
- ARIA labels for screen readers
- Proper image alt text
- Keyboard navigation support
- Focus indicators on interactive elements
- Screen reader only text for rating labels

## Styling

The component uses Tailwind CSS utility classes and follows the project's design system:
- Primary color: Indigo (indigo-600, indigo-700)
- Accent color: Amber (for affiliate badge)
- Responsive breakpoints: sm, lg
- Hover states and transitions

## Testing

The component includes comprehensive tests covering:
- Product information rendering
- Affiliate disclosure display
- Rating display logic
- Image attributes
- Event emission
- Accessibility features
- Responsive styling

Run tests with:
```bash
pnpm test -- tests/components/ProductCard.test.ts
```
