/**
 * FeaturesContext — loads the current restaurant's feature flags and exposes
 * them app-wide so any component can check `features.kitchen_display` etc.
 *
 * The Layout uses this to show/hide nav items.
 * Individual pages use it to hide sections or show "not available" messages.
 *
 * Defaults to ALL features ON so the app works even before the API responds.
 */
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import api from '../api'
import { useAuth } from './AuthContext'
import type { RestaurantType } from '../config/restaurantTypes'

export interface RestaurantFeatures {
  kitchen_display: boolean
  inventory: boolean
  reports: boolean
  qr_ordering: boolean
  whatsapp: boolean
  zomato: boolean
  payments: boolean
  waiter_app: boolean
}

const DEFAULT_FEATURES: RestaurantFeatures = {
  kitchen_display: true,
  inventory: true,
  reports: true,
  qr_ordering: true,
  whatsapp: true,
  zomato: true,
  payments: true,
  waiter_app: true,
}

interface FeaturesContextType {
  features: RestaurantFeatures
  restaurantType: RestaurantType | null
  loading: boolean
  reload: () => Promise<void>
}

const FeaturesContext = createContext<FeaturesContextType>({
  features: DEFAULT_FEATURES,
  restaurantType: null,
  loading: false,
  reload: async () => {},
})

export const useFeatures = () => useContext(FeaturesContext)

export const FeaturesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth()
  const [features, setFeatures] = useState<RestaurantFeatures>(DEFAULT_FEATURES)
  const [restaurantType, setRestaurantType] = useState<RestaurantType | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = async () => {
    if (!user) return
    try {
      const res = await api.get('/restaurants/me')
      const f = res.data.data?.features
      if (f) setFeatures({ ...DEFAULT_FEATURES, ...f })
      // Extract restaurant_type from the same response (no extra API call)
      const rt = res.data.data?.restaurant_type
      if (rt) setRestaurantType(rt)
    } catch {
      // Non-fatal — keep defaults
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { reload() }, [user])

  return (
    <FeaturesContext.Provider value={{ features, restaurantType, loading, reload }}>
      {children}
    </FeaturesContext.Provider>
  )
}
