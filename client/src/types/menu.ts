export interface MenuCategory {
  id: string
  restaurant_id: string
  name: string
  description?: string
  display_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface MenuItem {
  id: string
  restaurant_id: string
  category_id: string
  name: string
  description?: string
  price: number
  prep_time_minutes: number
  is_vegetarian: boolean
  is_active: boolean
  display_order: number
  created_at: string
  updated_at: string
}
