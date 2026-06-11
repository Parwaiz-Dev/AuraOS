export interface InventoryItem {
  id: string
  restaurant_id: string
  menu_item_id: string
  menu_item_name?: string
  menu_item_active?: boolean
  // Backend field names
  current_stock: number
  reorder_level: number
  last_restocked_at?: string
  created_at: string
  updated_at: string
  // Frontend aliases (for backward compat)
  quantity?: number
  low_stock_threshold?: number
  unit?: string
}

export interface InventoryStats {
  total_items: number
  low_stock_items: number
  average_stock: number
  total_stock: number
}
