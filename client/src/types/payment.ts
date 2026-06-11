export type PaymentMethod = 'CASH' | 'CARD' | 'UPI' | 'ONLINE'
export type PaymentStatus = 'PENDING' | 'PAID' | 'REFUNDED'

export interface Payment {
  id: string
  restaurant_id: string
  order_id: string
  amount: number
  method: PaymentMethod
  status: PaymentStatus
  reference_number?: string | null
  created_at: string
  updated_at: string
  // Joined from orders + restaurant_tables (available in list view)
  order_number?: string | null
  order_type?: string | null
  table_number?: string | null
}
