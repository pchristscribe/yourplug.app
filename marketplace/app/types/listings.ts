export type ConsignmentCondition = 'NEW' | 'LIKE_NEW' | 'GOOD' | 'FAIR'
export type ConsignmentCategory = 'APPAREL' | 'ACCESSORIES' | 'UNDERWEAR' | 'HARNESS' | 'TOY' | 'OTHER'
export type ListingStatus = 'DRAFT' | 'PENDING_MODERATION' | 'APPROVED' | 'REJECTED' | 'SOLD' | 'ARCHIVED'
export type ModerationDecision = 'PENDING' | 'APPROVED' | 'REJECTED' | 'FLAGGED'
export type OfferStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN' | 'EXPIRED'
export type PaymentStatus = 'PENDING' | 'AWAITING_SHIPMENT' | 'SHIPPED' | 'COMPLETED' | 'REFUNDED' | 'DISPUTED'

export interface ListingImage {
  id: string
  listingId: string
  publicUrl: string
  isPrimary: boolean
  sortOrder: number
  createdAt: string
}

export interface ListingSummary {
  id: string
  title: string
  condition: ConsignmentCondition
  category: ConsignmentCategory
  askingPrice: number
  createdAt: string
  sellerDisplayName: string | null
  primaryImageUrl: string | null
}

export interface ListingDetail extends ListingSummary {
  description: string
  status: ListingStatus
  moderationStatus: ModerationDecision
  moderationReason: string | null
  sellerTotalSales: number
  images: ListingImage[]
}

export interface SellerListing extends ListingDetail {
  platformFeePct: number
  soldAt: string | null
  updatedAt: string
}

export interface ConsignmentOffer {
  id: string
  listingId: string
  buyerId: string
  amount: number
  status: OfferStatus
  message: string | null
  expiresAt: string
  createdAt: string
  updatedAt: string
  listingTitle?: string
  listingAskingPrice?: number
  listingPrimaryImage?: string | null
}

export interface ListingFilters {
  category?: ConsignmentCategory
  condition?: ConsignmentCondition
  minPrice?: number
  maxPrice?: number
  sortBy?: 'askingPrice' | 'createdAt'
  order?: 'asc' | 'desc'
  page?: number
  limit?: number
}

export interface PaginatedListings {
  data: ListingSummary[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export interface CreateListingPayload {
  title: string
  description?: string
  condition: ConsignmentCondition
  category: ConsignmentCategory
  askingPrice: number
}
