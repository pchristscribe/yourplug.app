/**
 * JSON Schema validation for Review endpoints
 * Following WebAuthn route pattern for defense-in-depth security
 */

/**
 * Schema for creating a new review
 * POST /api/admin/reviews
 */
export const createReviewSchema = {
  body: {
    type: 'object',
    required: ['productId', 'rating', 'content'],
    properties: {
      productId: {
        type: 'string',
        minLength: 1,
        description: 'ID of the product being reviewed'
      },
      rating: {
        type: 'integer',
        minimum: 1,
        maximum: 5,
        description: 'Star rating (1-5)'
      },
      title: {
        type: 'string',
        maxLength: 200,
        description: 'Review title (optional)'
      },
      content: {
        type: 'string',
        minLength: 10,
        maxLength: 5000,
        description: 'Review content (min 10, max 5000 characters)'
      },
      pros: {
        type: 'array',
        maxItems: 10,
        items: {
          type: 'string',
          maxLength: 200
        },
        description: 'List of pros (max 10 items)'
      },
      cons: {
        type: 'array',
        maxItems: 10,
        items: {
          type: 'string',
          maxLength: 200
        },
        description: 'List of cons (max 10 items)'
      },
      authorName: {
        type: 'string',
        minLength: 1,
        maxLength: 100,
        description: 'Author name (defaults to "yourplug Team" if not provided)'
      },
      isFeatured: {
        type: 'boolean',
        description: 'Whether this review should be featured'
      }
    },
    additionalProperties: false
  }
}

/**
 * Schema for updating an existing review
 * PATCH /api/admin/reviews/:id
 */
export const updateReviewSchema = {
  body: {
    type: 'object',
    properties: {
      productId: {
        type: 'string',
        minLength: 1,
        description: 'ID of the product being reviewed'
      },
      rating: {
        type: 'integer',
        minimum: 1,
        maximum: 5,
        description: 'Star rating (1-5)'
      },
      title: {
        type: 'string',
        maxLength: 200,
        description: 'Review title'
      },
      content: {
        type: 'string',
        minLength: 10,
        maxLength: 5000,
        description: 'Review content'
      },
      pros: {
        type: 'array',
        maxItems: 10,
        items: {
          type: 'string',
          maxLength: 200
        },
        description: 'List of pros'
      },
      cons: {
        type: 'array',
        maxItems: 10,
        items: {
          type: 'string',
          maxLength: 200
        },
        description: 'List of cons'
      },
      authorName: {
        type: 'string',
        minLength: 1,
        maxLength: 100,
        description: 'Author name'
      },
      isFeatured: {
        type: 'boolean',
        description: 'Whether this review should be featured'
      }
    },
    additionalProperties: false,
    minProperties: 1 // At least one field must be provided for update
  },
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: {
        type: 'string',
        minLength: 1,
        description: 'Review ID'
      }
    }
  }
}

/**
 * Schema for deleting a single review
 * DELETE /api/admin/reviews/:id
 */
export const deleteReviewSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: {
        type: 'string',
        minLength: 1,
        description: 'Review ID'
      }
    }
  }
}

/**
 * Schema for bulk deleting reviews
 * POST /api/admin/reviews/bulk/delete
 */
export const bulkDeleteReviewsSchema = {
  body: {
    type: 'object',
    required: ['reviewIds'],
    properties: {
      reviewIds: {
        type: 'array',
        minItems: 1,
        maxItems: 100, // Prevent DoS via extremely large arrays
        items: {
          type: 'string',
          minLength: 1
        },
        description: 'Array of review IDs to delete'
      }
    },
    additionalProperties: false
  }
}

/**
 * Schema for bulk toggling featured status
 * POST /api/admin/reviews/bulk/toggle-featured
 */
export const bulkToggleFeaturedSchema = {
  body: {
    type: 'object',
    required: ['reviewIds', 'isFeatured'],
    properties: {
      reviewIds: {
        type: 'array',
        minItems: 1,
        maxItems: 100, // Prevent DoS via extremely large arrays
        items: {
          type: 'string',
          minLength: 1
        },
        description: 'Array of review IDs to update'
      },
      isFeatured: {
        type: 'boolean',
        description: 'New featured status for all selected reviews'
      }
    },
    additionalProperties: false
  }
}

/**
 * Schema for listing reviews with filtering and pagination
 * GET /api/admin/reviews
 */
export const listReviewsSchema = {
  querystring: {
    type: 'object',
    properties: {
      productId: {
        type: 'string',
        description: 'Filter by product ID'
      },
      isFeatured: {
        type: 'string',
        enum: ['true', 'false'],
        description: 'Filter by featured status'
      },
      rating: {
        type: 'string',
        pattern: '^[1-5]$',
        description: 'Filter by rating (1-5)'
      },
      search: {
        type: 'string',
        maxLength: 200,
        description: 'Search term for content/title/author'
      },
      page: {
        type: 'integer',
        minimum: 1,
        default: 1,
        description: 'Page number'
      },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: 100,
        default: 20,
        description: 'Items per page'
      },
      sortBy: {
        type: 'string',
        enum: ['createdAt', 'updatedAt', 'rating'],
        default: 'createdAt',
        description: 'Field to sort by'
      },
      order: {
        type: 'string',
        enum: ['asc', 'desc'],
        default: 'desc',
        description: 'Sort order'
      }
    }
  }
}
