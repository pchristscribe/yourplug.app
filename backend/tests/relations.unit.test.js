import { describe, it, expect } from 'vitest'
import {
  createReviewSchema,
  updateReviewSchema,
  bulkDeleteReviewsSchema,
  bulkToggleFeaturedSchema,
  listReviewsSchema,
} from '../src/schemas/review.js'
import {
  createCategorySchema,
  updateCategorySchema,
  bulkDeleteCategoriesSchema,
  listCategoriesSchema,
} from '../src/schemas/category.js'

/**
 * Unit tests for the Fastify JSON schemas that govern entity relationships.
 *
 * These tests verify:
 *  - Required fields are declared on the correct entity schemas
 *  - Property constraints (type, minLength, maxLength, pattern, enum) are correct
 *  - additionalProperties is false where cross-entity data must be controlled
 *  - Foreign-key fields (productId, categoryIds, reviewIds) are present and constrained
 *  - Bulk-operation schemas enforce array size limits to prevent DoS
 */

// ── Review Schema ────────────────────────────────────────────────────────────

describe('createReviewSchema', () => {
  const { body } = createReviewSchema

  it('requires productId, rating, and content', () => {
    expect(body.required).toContain('productId')
    expect(body.required).toContain('rating')
    expect(body.required).toContain('content')
  })

  it('does not allow additional properties', () => {
    expect(body.additionalProperties).toBe(false)
  })

  it('enforces integer type on rating', () => {
    expect(body.properties.rating.type).toBe('integer')
  })

  it('constrains rating to 1–5', () => {
    expect(body.properties.rating.minimum).toBe(1)
    expect(body.properties.rating.maximum).toBe(5)
  })

  it('enforces minimum content length of 10', () => {
    expect(body.properties.content.minLength).toBe(10)
  })

  it('enforces maximum content length of 5000', () => {
    expect(body.properties.content.maxLength).toBe(5000)
  })

  it('enforces maximum title length of 200', () => {
    expect(body.properties.title.maxLength).toBe(200)
  })

  it('limits pros and cons arrays to 10 items each', () => {
    expect(body.properties.pros.maxItems).toBe(10)
    expect(body.properties.cons.maxItems).toBe(10)
  })

  it('limits individual pros/cons item length to 200', () => {
    expect(body.properties.pros.items.maxLength).toBe(200)
    expect(body.properties.cons.items.maxLength).toBe(200)
  })

  it('constrains authorName to a maximum of 100 characters', () => {
    expect(body.properties.authorName.maxLength).toBe(100)
  })

  it('defines productId as a non-empty string', () => {
    expect(body.properties.productId.type).toBe('string')
    expect(body.properties.productId.minLength).toBe(1)
  })

  it('isFeatured is a boolean property', () => {
    expect(body.properties.isFeatured.type).toBe('boolean')
  })
})

describe('updateReviewSchema', () => {
  const { body, params } = updateReviewSchema

  it('requires at least one field (minProperties: 1)', () => {
    expect(body.minProperties).toBe(1)
  })

  it('does not allow additional properties', () => {
    expect(body.additionalProperties).toBe(false)
  })

  it('has a params schema requiring an id', () => {
    expect(params.required).toContain('id')
    expect(params.properties.id.type).toBe('string')
  })

  it('accepts same constraints as create for content', () => {
    expect(body.properties.content.minLength).toBe(10)
    expect(body.properties.content.maxLength).toBe(5000)
  })

  it('allows productId to be updated', () => {
    expect(body.properties.productId).toBeDefined()
    expect(body.properties.productId.minLength).toBe(1)
  })
})

describe('bulkDeleteReviewsSchema', () => {
  const { body } = bulkDeleteReviewsSchema

  it('requires reviewIds', () => {
    expect(body.required).toContain('reviewIds')
  })

  it('enforces minItems: 1 to prevent empty bulk operations', () => {
    expect(body.properties.reviewIds.minItems).toBe(1)
  })

  it('enforces maxItems: 100 to prevent DoS via oversized arrays', () => {
    expect(body.properties.reviewIds.maxItems).toBe(100)
  })

  it('does not allow additional properties', () => {
    expect(body.additionalProperties).toBe(false)
  })

  it('each reviewId item is a non-empty string', () => {
    expect(body.properties.reviewIds.items.type).toBe('string')
    expect(body.properties.reviewIds.items.minLength).toBe(1)
  })
})

describe('bulkToggleFeaturedSchema', () => {
  const { body } = bulkToggleFeaturedSchema

  it('requires both reviewIds and isFeatured', () => {
    expect(body.required).toContain('reviewIds')
    expect(body.required).toContain('isFeatured')
  })

  it('enforces minItems: 1 on reviewIds', () => {
    expect(body.properties.reviewIds.minItems).toBe(1)
  })

  it('enforces maxItems: 100 on reviewIds', () => {
    expect(body.properties.reviewIds.maxItems).toBe(100)
  })

  it('isFeatured must be a boolean', () => {
    expect(body.properties.isFeatured.type).toBe('boolean')
  })

  it('does not allow additional properties', () => {
    expect(body.additionalProperties).toBe(false)
  })
})

describe('listReviewsSchema', () => {
  const { querystring } = listReviewsSchema

  it('accepts productId as an optional filter string', () => {
    expect(querystring.properties.productId.type).toBe('string')
  })

  it('validates sortBy against an allowlist enum', () => {
    expect(querystring.properties.sortBy.enum).toContain('createdAt')
    expect(querystring.properties.sortBy.enum).toContain('updatedAt')
    expect(querystring.properties.sortBy.enum).toContain('rating')
  })

  it('validates order against asc/desc enum', () => {
    expect(querystring.properties.order.enum).toContain('asc')
    expect(querystring.properties.order.enum).toContain('desc')
  })

  it('limits search string to 200 characters', () => {
    expect(querystring.properties.search.maxLength).toBe(200)
  })

  it('enforces minimum page of 1', () => {
    expect(querystring.properties.page.minimum).toBe(1)
  })

  it('enforces maximum limit of 100', () => {
    expect(querystring.properties.limit.maximum).toBe(100)
  })

  it('validates isFeatured as a string enum (true/false)', () => {
    expect(querystring.properties.isFeatured.enum).toContain('true')
    expect(querystring.properties.isFeatured.enum).toContain('false')
  })

  it('validates rating pattern to 1-5 digits only', () => {
    expect(querystring.properties.rating.pattern).toBe('^[1-5]$')
  })
})

// ── Category Schema ──────────────────────────────────────────────────────────

describe('createCategorySchema', () => {
  const { body } = createCategorySchema

  it('requires name and slug', () => {
    expect(body.required).toContain('name')
    expect(body.required).toContain('slug')
  })

  it('does not allow additional properties', () => {
    expect(body.additionalProperties).toBe(false)
  })

  it('enforces slug pattern: lowercase alphanumeric and hyphens only', () => {
    expect(body.properties.slug.pattern).toBe('^[a-z0-9-]+$')
  })

  it('limits name to 100 characters', () => {
    expect(body.properties.name.maxLength).toBe(100)
  })

  it('limits slug to 100 characters', () => {
    expect(body.properties.slug.maxLength).toBe(100)
  })

  it('limits description to 500 characters', () => {
    expect(body.properties.description.maxLength).toBe(500)
  })

  it('validates imageUrl with http/https pattern', () => {
    expect(body.properties.imageUrl.pattern).toBe('^https?://.+')
  })

  it('limits imageUrl to 2048 characters', () => {
    expect(body.properties.imageUrl.maxLength).toBe(2048)
  })
})

describe('updateCategorySchema', () => {
  const { body, params } = updateCategorySchema

  it('requires at least one field (minProperties: 1)', () => {
    expect(body.minProperties).toBe(1)
  })

  it('does not allow additional properties', () => {
    expect(body.additionalProperties).toBe(false)
  })

  it('has a params schema requiring an id', () => {
    expect(params.required).toContain('id')
  })

  it('enforces the same slug pattern as create', () => {
    expect(body.properties.slug.pattern).toBe('^[a-z0-9-]+$')
  })
})

describe('bulkDeleteCategoriesSchema', () => {
  const { body } = bulkDeleteCategoriesSchema

  it('requires categoryIds', () => {
    expect(body.required).toContain('categoryIds')
  })

  it('enforces minItems: 1 to prevent empty bulk operations', () => {
    expect(body.properties.categoryIds.minItems).toBe(1)
  })

  it('enforces maxItems: 100 to prevent DoS via oversized arrays', () => {
    expect(body.properties.categoryIds.maxItems).toBe(100)
  })

  it('does not allow additional properties', () => {
    expect(body.additionalProperties).toBe(false)
  })

  it('each categoryId item is a non-empty string', () => {
    expect(body.properties.categoryIds.items.type).toBe('string')
    expect(body.properties.categoryIds.items.minLength).toBe(1)
  })
})

describe('listCategoriesSchema', () => {
  const { querystring } = listCategoriesSchema

  it('validates sortBy against an allowlist enum', () => {
    expect(querystring.properties.sortBy.enum).toContain('name')
    expect(querystring.properties.sortBy.enum).toContain('createdAt')
    expect(querystring.properties.sortBy.enum).toContain('updatedAt')
  })

  it('validates order against asc/desc enum', () => {
    expect(querystring.properties.order.enum).toContain('asc')
    expect(querystring.properties.order.enum).toContain('desc')
  })

  it('limits search string to 200 characters', () => {
    expect(querystring.properties.search.maxLength).toBe(200)
  })

  it('enforces minimum page of 1', () => {
    expect(querystring.properties.page.minimum).toBe(1)
  })

  it('enforces maximum limit of 100', () => {
    expect(querystring.properties.limit.maximum).toBe(100)
  })

  it('sortBy does not allow arbitrary values (enum is exhaustive)', () => {
    const allowedValues = querystring.properties.sortBy.enum
    expect(allowedValues.length).toBe(3)
    expect(allowedValues).not.toContain('id')
    expect(allowedValues).not.toContain('slug')
  })
})

// ── Cross-schema relationship constraints ─────────────────────────────────────

describe('cross-schema relationship constraints', () => {
  it('review schema productId field enforces non-empty string (foreign key marker)', () => {
    // Reviews reference products via productId — it should never be an empty string
    expect(createReviewSchema.body.properties.productId.minLength).toBeGreaterThan(0)
    expect(updateReviewSchema.body.properties.productId.minLength).toBeGreaterThan(0)
  })

  it('both bulk schemas share the same DoS-prevention cap of 100 items', () => {
    expect(bulkDeleteReviewsSchema.body.properties.reviewIds.maxItems).toBe(
      bulkDeleteCategoriesSchema.body.properties.categoryIds.maxItems
    )
  })

  it('both list schemas use the same sortable order enum values', () => {
    const reviewOrderEnum = listReviewsSchema.querystring.properties.order.enum
    const categoryOrderEnum = listCategoriesSchema.querystring.properties.order.enum
    expect(reviewOrderEnum).toEqual(expect.arrayContaining(categoryOrderEnum))
    expect(categoryOrderEnum).toEqual(expect.arrayContaining(reviewOrderEnum))
  })
})