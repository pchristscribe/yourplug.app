# yourplug User Frontend

User-facing product catalog for the yourplug affiliate marketing platform.

## Tech Stack

- **Framework**: Nuxt 4 (Vue 3 + SSR), `compatibilityDate: '2025-07-15'`
- **Port**: 3000 (HMR: 24677)
- **Styling**: Tailwind CSS (custom design system — Dosis font, brand colors)
- **State Management**: Pinia
- **UI Components**: Headless UI (`nuxt-headlessui`, prefix: `Headless`)
- **Data**: Supabase via `@nuxtjs/supabase`
- **Monitoring**: Sentry (`@sentry/nuxt`)
- **Testing**: Vitest + Vue Test Utils + happy-dom
- **Linting**: ESLint with typescript-eslint + eslint-plugin-vue

## Setup

```bash
pnpm install
```

## Development

```bash
pnpm dev         # http://localhost:3000
pnpm build       # production build
pnpm preview     # preview production build locally
```

## Testing

```bash
pnpm test              # run all tests
pnpm test:watch        # watch mode
pnpm test:ui           # Vitest visual UI
pnpm test:coverage     # coverage report (v8)
```

## Project Structure

```text
frontend/
├── app/
│   ├── components/
│   │   ├── ProductCard.vue           # Product card with affiliate link + FTC disclosure
│   │   ├── ProductCardSimple.vue     # Lightweight card variant
│   │   ├── ProductGrid.vue           # Responsive grid with loading skeleton + empty state
│   │   ├── SearchBar.vue             # Debounced search with clear button
│   │   ├── Pagination.vue            # Smart pagination with ellipsis
│   │   ├── DarkModeToggle.vue        # Dark/light mode switcher
│   │   ├── feedback/
│   │   │   ├── AppToast.vue          # Individual toast notification
│   │   │   ├── AppToastContainer.vue # Toast queue container
│   │   │   ├── AppModal.vue          # Modal dialog
│   │   │   └── AppAlert.vue          # Inline alert
│   │   └── filters/
│   │       ├── ProductFilters.vue    # Main filter panel (groups all filters)
│   │       ├── CategoryFilter.vue    # Category dropdown
│   │       ├── PriceRangeFilter.vue  # Dual-range price slider with presets
│   │       ├── RatingFilter.vue      # Star rating button selector
│   │       └── SortingControls.vue   # Sort field + asc/desc toggle
│   │
│   ├── composables/
│   │   ├── useDarkMode.ts            # Dark/light mode state + persistence
│   │   ├── useToast.ts               # Toast notification system
│   │   └── useSupabaseProducts.ts    # Supabase product data fetching (primary data layer)
│   │
│   ├── layouts/
│   │   └── default.vue               # Shared layout (nav, footer)
│   │
│   ├── pages/
│   │   ├── index.vue                 # Product catalog home (filters + grid)
│   │   ├── products/[id].vue         # Product detail page (dynamic route)
│   │   └── search-demo.vue           # Search demonstration page
│   │
│   ├── stores/
│   │   ├── filters.ts                # Filter state (category, platform, price, rating, sort)
│   │   └── products.ts               # Product catalog + categories data
│   │
│   └── types/
│       ├── index.ts                  # Product, Category, Platform, ProductFilters types
│       ├── filters.ts                # FilterState interface + DEFAULT_FILTER_STATE
│       ├── database.types.ts         # Supabase-generated DB types
│       └── supabase.ts               # Supabase client types
│
├── tests/
│   ├── ProductCard.test.ts
│   ├── ProductCardSimple.test.ts
│   ├── SearchBar.test.ts
│   ├── darkMode.test.ts
│   ├── filters.test.ts
│   ├── stores.test.ts
│   ├── types.test.ts
│   ├── useToast.test.ts
│   └── components/
│
├── nuxt.config.ts                    # Nuxt config (port, modules, Supabase, HMR)
├── tailwind.config.js                # Tailwind (brand colors, Dosis font, dark mode)
├── vitest.config.ts                  # Vitest (happy-dom, v8 coverage)
├── eslint.config.ts                  # ESLint (Vue, TS, JSON, Markdown, CSS)
└── tsconfig.json
```

## State Management

### Filter Store (`stores/filters.ts`)

Manages all filter/sort state with URL synchronization:

```typescript
// State shape
{
  categoryId: string          // selected category ID ('' = all)
  platform: Platform | ''     // DHgate | AliExpress | Amazon | Wish | ''
  minPrice: number            // 0–500
  maxPrice: number            // 0–500
  minRating: number           // 0 = all, 4 = 4+, 4.5 = 4.5+
  sortBy: 'createdAt' | 'price' | 'rating' | 'title'
  order: 'asc' | 'desc'
}
```

Key methods:
- `initFromQuery(route.query)` — restore state from URL on mount
- `toQueryParams()` — serialize to URL query string
- `toProductFilters` getter — convert to API request format
- `clearAllFilters()` — reset to defaults

### Products Store (`stores/products.ts`)

Product catalog data and category list. Includes `filteredProducts` getter that applies client-side rating filter after API fetch.

## Filtering System

Filters use **AND logic** — products must match all active filters.

- **Server-side**: category, platform, price range, sorting
- **Client-side**: rating (applied after API fetch for immediate feedback)
- **URL sync**: filters serialize to query params for shareable/bookmarkable links

See [FILTERING_SYSTEM.md](./FILTERING_SYSTEM.md) for full architecture details.

## Design System

Shared with admin frontend:
- **Font**: Dosis (variable weight 200–800)
- **Brand color**: `#8B1E2D` (deep red)
- **Accent**: `#D6A77A` (skin tone)
- **Dark mode**: `class` strategy — `useDarkMode` composable

## Environment Variables

```bash
NUXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NUXT_PUBLIC_SUPABASE_KEY=your-anon-key
NUXT_PUBLIC_API_BASE=http://localhost:3000
```

## Legal

All affiliate links include FTC-compliant disclosures — the site receives monetary compensation from affiliate programs.

## References

- [Nuxt 4 Documentation](https://nuxt.com/docs)
- [Vitest Documentation](https://vitest.dev/)
- [Pinia Documentation](https://pinia.vuejs.org/)
- [Headless UI (Vue)](https://headlessui.com/v1/vue)
- [Root README](../README.md)
- [FILTERING_SYSTEM.md](./FILTERING_SYSTEM.md)
- [TEST_COVERAGE_SUMMARY.md](../TEST_COVERAGE_SUMMARY.md)
