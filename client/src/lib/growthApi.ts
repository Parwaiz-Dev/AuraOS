// Growth-features API (Phase 3): reservations + delivery zones.
// Kept in a separate module so it composes with the shared authenticated axios
// instance (default export of ../api) without touching that file.
import api from '../api'

export interface Reservation {
  id: string
  customer_name: string
  customer_phone: string
  party_size: number
  reserved_for: string
  special_requests: string | null
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED'
  created_at: string
}

export interface DeliveryZone {
  id: string
  name: string
  pincode: string | null
  fee: number
  min_order: number
  eta_minutes: number | null
  is_active: boolean
}

export const reservationApi = {
  list: (status?: string) =>
    api.get('/reservations', { params: status ? { status } : {} }),
  updateStatus: (id: string, status: Reservation['status']) =>
    api.patch(`/reservations/${id}`, { status }),
}

export const deliveryZoneApi = {
  list: () => api.get('/delivery-zones'),
  create: (data: Partial<DeliveryZone>) => api.post('/delivery-zones', data),
  update: (id: string, data: Partial<DeliveryZone>) =>
    api.patch(`/delivery-zones/${id}`, data),
  remove: (id: string) => api.delete(`/delivery-zones/${id}`),
}

export interface Coupon {
  id: string
  code: string
  description: string | null
  discount_type: 'FLAT' | 'PERCENT'
  discount_value: number
  min_order: number
  max_discount: number | null
  usage_limit: number | null
  used_count: number
  valid_until: string | null
  is_active: boolean
}

export const couponApi = {
  list: () => api.get('/coupons'),
  create: (data: Partial<Coupon>) => api.post('/coupons', data),
  update: (id: string, data: Partial<Coupon>) => api.patch(`/coupons/${id}`, data),
  remove: (id: string) => api.delete(`/coupons/${id}`),
}

export interface OwnerReview {
  id: string
  rating: number
  title: string | null
  body: string | null
  is_published: boolean
  created_at: string
  customer_name: string | null
}

export const reviewApi = {
  list: () => api.get('/reviews'),
  setPublished: (id: string, is_published: boolean) =>
    api.patch(`/reviews/${id}`, { is_published }),
  remove: (id: string) => api.delete(`/reviews/${id}`),
}

export interface LoyaltyConfig {
  loyalty_enabled: boolean
  loyalty_points_per_currency: number
  loyalty_redeem_value: number
}

export const loyaltyApi = {
  getConfig: () => api.get('/loyalty/config'),
  updateConfig: (data: Partial<LoyaltyConfig>) => api.patch('/loyalty/config', data),
}
