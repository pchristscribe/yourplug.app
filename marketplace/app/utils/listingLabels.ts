// Single source of truth for enum display labels — previously duplicated
// between pages/index.vue and components/ListingCard.vue.
export const CONDITION_LABELS: Record<string, string> = {
  NEW: 'New',
  LIKE_NEW: 'Like New',
  GOOD: 'Good',
  FAIR: 'Fair',
}

export const CATEGORY_LABELS: Record<string, string> = {
  APPAREL: 'Apparel',
  ACCESSORIES: 'Accessories',
  UNDERWEAR: 'Underwear',
  HARNESS: 'Harness',
  TOY: 'Toy',
  OTHER: 'Other',
}

export const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }))
export const CONDITION_OPTIONS = Object.entries(CONDITION_LABELS).map(([value, label]) => ({ value, label }))
