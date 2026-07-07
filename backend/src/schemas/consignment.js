const CONDITION_ENUM = ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR']
const CATEGORY_ENUM = ['APPAREL', 'ACCESSORIES', 'UNDERWEAR', 'HARNESS', 'TOY', 'OTHER']
const SORT_BY_ENUM = ['askingPrice', 'createdAt']
const ORDER_ENUM = ['asc', 'desc']

export const createListingSchema = {
  body: {
    type: 'object',
    required: ['title', 'condition', 'category', 'askingPrice'],
    properties: {
      title: { type: 'string', minLength: 1, maxLength: 120 },
      description: { type: 'string', maxLength: 2000 },
      condition: { type: 'string', enum: CONDITION_ENUM },
      category: { type: 'string', enum: CATEGORY_ENUM },
      askingPrice: { type: 'number', minimum: 0.01 },
    },
    additionalProperties: false,
  },
}

export const updateListingSchema = {
  body: {
    type: 'object',
    minProperties: 1,
    properties: {
      title: { type: 'string', minLength: 1, maxLength: 120 },
      description: { type: 'string', maxLength: 2000 },
      condition: { type: 'string', enum: CONDITION_ENUM },
      category: { type: 'string', enum: CATEGORY_ENUM },
      askingPrice: { type: 'number', minimum: 0.01 },
    },
    additionalProperties: false,
  },
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', minLength: 1 } },
  },
}

export const createOfferSchema = {
  body: {
    type: 'object',
    required: ['amount'],
    properties: {
      amount: { type: 'number', minimum: 0.01 },
      message: { type: 'string', maxLength: 500 },
    },
    additionalProperties: false,
  },
}

export const uuidParamsSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      // Fastify's default Ajv has no 'uuid' format (needs ajv-formats), so use a pattern
      id: { type: 'string', pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' },
    },
  },
}

export const adminListListingsSchema = {
  querystring: {
    type: 'object',
    properties: {
      moderationStatus: { type: 'string', enum: ['APPROVED', 'REJECTED', 'FLAGGED', 'PENDING_MODERATION'] },
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    },
    additionalProperties: false,
  },
}

export const rejectListingSchema = {
  ...uuidParamsSchema,
  body: {
    type: 'object',
    required: ['reason'],
    properties: {
      reason: { type: 'string', minLength: 1, maxLength: 1000 },
    },
    additionalProperties: false,
  },
}

export const listListingsSchema = {
  querystring: {
    type: 'object',
    properties: {
      category: { type: 'string', enum: CATEGORY_ENUM },
      condition: { type: 'string', enum: CONDITION_ENUM },
      minPrice: { type: 'number', minimum: 0 },
      maxPrice: { type: 'number', minimum: 0 },
      sortBy: { type: 'string', enum: SORT_BY_ENUM, default: 'createdAt' },
      order: { type: 'string', enum: ORDER_ENUM, default: 'desc' },
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
    },
  },
}
