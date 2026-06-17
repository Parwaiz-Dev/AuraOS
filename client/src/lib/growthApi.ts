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
