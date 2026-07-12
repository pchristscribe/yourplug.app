const CONDITION_ENUM = ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR']
const CATEGORY_ENUM = ['APPAREL', 'ACCESSORIES', 'UNDERWEAR', 'HARNESS', 'TOY', 'OTHER']
const SORT_BY_ENUM = ['askingPrice', 'createdAt']
const ORDER_ENUM = ['asc', 'desc']
const UUID_PATTERN = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
// numeric(10,2) column limit — reject oversized values with a clean 400
// instead of a DB error at insert time.
const MAX_MONEY = 99999999.99

export const createListingSchema = {
  body: {
    type: 'object',
    required: ['title', 'condition', 'category', 'askingPrice'],
    properties: {
      title: { type: 'string', minLength: 1, maxLength: 120 },
      description: { type: 'string', maxLength: 2000 },
      condition: { type: 'string', enum: CONDITION_ENUM },
      category: { type: 'string', enum: CATEGORY_ENUM },
      askingPrice: { type: 'number', minimum: 0.01, maximum: MAX_MONEY },
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
      askingPrice: { type: 'number', minimum: 0.01, maximum: MAX_MONEY },
    },
    additionalProperties: false,
  },
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', pattern: UUID_PATTERN } },
  },
}

export const createOfferSchema = {
  body: {
    type: 'object',
    required: ['amount'],
    properties: {
      amount: { type: 'number', minimum: 0.01, maximum: MAX_MONEY },
      message: { type: 'string', maxLength: 500 },
    },
    additionalProperties: false,
  },
}

export const createTransactionSchema = {
  body: {
    type: 'object',
    required: ['offerId'],
    properties: {
      offerId: { type: 'string', pattern: UUID_PATTERN },
    },
    additionalProperties: false,
  },
}

export const offerActionSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', pattern: UUID_PATTERN } },
  },
  body: {
    type: 'object',
    required: ['action'],
    properties: {
      action: { type: 'string', enum: ['ACCEPTED', 'REJECTED'] },
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
      id: { type: 'string', pattern: UUID_PATTERN },
    },
  },
}

export const adminListListingsSchema = {
  querystring: {
    type: 'object',
    properties: {
      moderationStatus: { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED', 'FLAGGED'] },
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
