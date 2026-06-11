export interface Restaurant {
  id: string
  name: string
  email: string
  phone?: string
  address?: string
  city?: string
  state?: string
  pincode?: string
  created_at: string
  updated_at: string
}

export interface RestaurantSettings {
  id: string
  restaurant_id: string
  timezone: string
  currency: string
  language: string
  enable_online_orders: boolean
  enable_zomato_integration: boolean
  enable_whatsapp_integration: boolean
  tax_rate: number
  service_charge_rate: number
  created_at: string
  updated_at: string
}

export interface CreateRestaurantRequest {
  name: string
  email: string
  phone?: string
  address?: string
  city?: string
  state?: string
  pincode?: string
}

export interface UpdateRestaurantRequest {
  name?: string
  email?: string
  phone?: string
  address?: string
  city?: string
  state?: string
  pincode?: string
}
