export interface User {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'WAITER' | 'RECEPTION' | 'KITCHEN'
  restaurantId: string
}

export interface Table {
  id: string
  table_number: string
  seats: number
  is_active: boolean
}

/** Active order summary attached to a table (from GET /tables/with-status) */
export interface TableActiveOrder {
  id: string
  order_number: string
  status: OrderStatus
  total_amount: number
  order_type: string
  created_at: string
  item_count: number
}

/** A table enriched with its current occupancy / active order */
export interface TableWithStatus extends Table {
  active_order: TableActiveOrder | null
}

export interface MenuCategory {
  id: string
  name: string
  display_order: number
  is_active: boolean
}

export interface MenuItem {
  id: string
  category_id: string
  name: string
  description?: string
  price: number
  prep_time_minutes: number
  is_vegetarian: boolean
  is_active: boolean
}

export type OrderStatus = 'CREATED' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED'
export type OrderType   = 'DINE_IN' | 'PARCEL' | 'ONLINE'
export type OrderSource = 'WAITER' | 'RECEPTION' | 'QR' | 'WHATSAPP' | 'ZOMATO'

export interface OrderItem {
  menu_item_id: string
  menu_item_name?: string
  quantity: number
  unit_price?: number
  special_instructions?: string
}

export interface Order {
  id: string
  order_number: string
  order_type: OrderType
  order_source: OrderSource
  status: OrderStatus
  total_amount: number
  table_id: string | null
  table?: { id: string; table_number: string } | null
  special_instructions?: string
  created_at: string
  updated_at: string
  order_items?: OrderItem[]
  items?: OrderItem[]
}

// Cart line — what the waiter is building before submitting
export interface CartLine {
  menu_item_id: string
  name: string
  price: number
  quantity: number
  special_instructions?: string
}

// Offline queue entry — order that couldn't be sent due to no connectivity
export interface QueuedOrder {
  id: string           // local UUID
  idempotency_key: string
  payload: {
    table_id?: string | null
    order_type: OrderType
    order_source: OrderSource
    special_instructions?: string
    items: Array<{ menu_item_id: string; quantity: number; special_instructions?: string }>
  }
  created_at: string
  retries: number
}
