/**
 * JSON Schema validation for Product endpoints
 * Following WebAuthn route pattern for defense-in-depth security
 */
import { VALID_PLATFORMS, VALID_STATUSES } from '../utils/constants.js'

// URL validation pattern: must start with http:// or https://
const URL_PATTERN = '^https?://.+'

const PRICE_PROPS = {
  type: 'number',
  minimum: 0,
  description: 'Product price'
}

const RATING_PROPS = {
  type: 'number',
  minimum: 0,
  maximum: 5,
  description: 'Average rating (0-5)'
}

const TAGS_PROPS = {
  type: 'array',
  maxItems: 50,
  items: {
    type: 'string',
    maxLength: 100
  },
  description: 'Product tags'
}

/**
 * Schema for creating a new product
 * POST /api/admin/products
 * Only externalId, platform, title, price, and categoryId are required —
 * every other column has a DB-level default (see 001_initial_schema.sql).
 */
export const createProductSchema = {
  body: {
    type: 'object',
    required: ['externalId', 'platform', 'title', 'price', 'categoryId'],
    properties: {
      externalId: {
        type: 'string',
        minLength: 1,
        maxLength: 200,
        description: 'Platform-assigned product ID'
      },
      platform: {
        type: 'string',
        enum: VALID_PLATFORMS,
        description: 'Source platform'
      },
      title: {
        type: 'string',
        minLength: 1,
        maxLength: 500,
        description: 'Product title'
      },
      description: {
        type: 'string',
        maxLength: 5000,
        description: 'Product description'
      },
      imageUrl: {
        type: 'string',
        maxLength: 2048,
        pattern: URL_PATTERN,
        description: 'Product image URL (must start with http:// or https://)'
      },
      price: PRICE_PROPS,
      currency: {
        type: 'string',
        minLength: 3,
        maxLength: 3,
        description: 'ISO 4217 currency code'
      },
      status: {
        type: 'string',
        enum: VALID_STATUSES,
        description: 'Product status'
      },
      categoryId: {
        type: 'string',
        minLength: 1,
        description: 'Category ID'
      },
      rating: RATING_PROPS,
      reviewCount: {
        type: 'integer',
        minimum: 0,
        description: 'Number of reviews'
      },
      tags: TAGS_PROPS,
      metadata: {
        type: 'object',
        description: 'Arbitrary platform-specific metadata'
      }
    },
    additionalProperties: false
  }
}

/**
 * Schema for updating an existing product
 * PATCH /api/admin/products/:id
 */
export const updateProductSchema = {
  body: {
    type: 'object',
    properties: {
      externalId: {
        type: 'string',
        minLength: 1,
        maxLength: 200,
        description: 'Platform-assigned product ID'
      },
      platform: {
        type: 'string',
        enum: VALID_PLATFORMS,
        description: 'Source platform'
      },
      title: {
        type: 'string',
        minLength: 1,
        maxLength: 500,
        description: 'Product title'
      },
      description: {
        type: 'string',
        maxLength: 5000,
        description: 'Product description'
      },
      imageUrl: {
        type: 'string',
        maxLength: 2048,
        pattern: URL_PATTERN,
        description: 'Product image URL (must start with http:// or https://)'
      },
      price: PRICE_PROPS,
      currency: {
        type: 'string',
        minLength: 3,
        maxLength: 3,
        description: 'ISO 4217 currency code'
      },
      status: {
        type: 'string',
        enum: VALID_STATUSES,
        description: 'Product status'
      },
      categoryId: {
        type: 'string',
        minLength: 1,
        description: 'Category ID'
      },
      rating: RATING_PROPS,
      reviewCount: {
        type: 'integer',
        minimum: 0,
        description: 'Number of reviews'
      },
      tags: TAGS_PROPS,
      metadata: {
        type: 'object',
        description: 'Arbitrary platform-specific metadata'
      }
    },
    // No minProperties here (unlike category/review update schemas): the
    // route treats an empty PATCH body as a no-op that returns the current
    // record unchanged, and existing tests lock that behavior in.
    additionalProperties: false
  },
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: {
        type: 'string',
        minLength: 1,
        description: 'Product ID'
      }
    }
  }
}

/**
 * Schema for bulk updating product status
 * POST /api/admin/products/bulk/status
 */
export const bulkStatusProductsSchema = {
  body: {
    type: 'object',
    required: ['productIds', 'status'],
    properties: {
      productIds: {
        type: 'array',
        minItems: 1,
        maxItems: 100,
        items: {
          type: 'string',
          minLength: 1
        },
        description: 'Array of product IDs to update'
      },
      status: {
        type: 'string',
        enum: VALID_STATUSES,
        description: 'New status for all selected products'
      }
    },
    additionalProperties: false
  }
}

/**
 * Schema for bulk deleting products
 * POST /api/admin/products/bulk/delete
 */
export const bulkDeleteProductsSchema = {
  body: {
    type: 'object',
    required: ['productIds'],
    properties: {
      productIds: {
        type: 'array',
        minItems: 1,
        maxItems: 100,
        items: {
          type: 'string',
          minLength: 1
        },
        description: 'Array of product IDs to delete'
      }
    },
    additionalProperties: false
  }
}
