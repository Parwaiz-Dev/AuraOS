export interface Table {
  id: string
  restaurant_id: string
  table_number: string
  seats: number
  is_active: boolean
  created_at: string
  updated_at: string
}

/**
 * The active (open) order attached to a table, as returned by
 * GET /tables/with-status. Null when the table is free.
 */
export interface TableActiveOrder {
  id: string
  order_number: string
  status: 'CREATED' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED'
  total_amount: number
  order_type: string
  created_at: string
  item_count: number
}

/**
 * A table enriched with its current occupancy / active order.
 * Powers the Tables command-center screen.
 */
export interface TableWithStatus extends Table {
  active_order: TableActiveOrder | null
}
