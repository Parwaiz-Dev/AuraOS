import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import api, { setAuthToken, setLogoutHandler } from '../api'

interface User {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'WAITER' | 'RECEPTION' | 'KITCHEN'
  restaurantId: string
  isSuperAdmin?: boolean
}

export interface AvailableRestaurant {
  id: string
  name: string
  slug: string
  restaurant_type: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  switchRestaurant: (restaurantId: string, restaurantName: string) => Promise<void>
  isAuthenticated: boolean
  isLoading: boolean
  currentRestaurantName: string | null
  setCurrentRestaurantName: (name: string | null) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentRestaurantName, setCurrentRestaurantName] = useState<string | null>(
    () => localStorage.getItem('restaurantName')
  )

  useEffect(() => {
    const storedToken = localStorage.getItem('token')
    setLogoutHandler(logout)

    if (storedToken) {
      setToken(storedToken)
      setAuthToken(storedToken)
      // Verify token and get user info
      fetchUserProfile()
    } else {
      setIsLoading(false)
    }
  }, [])

  const fetchUserProfile = async () => {
    try {
      const response = await api.get('/auth/me')
      const u = response.data.data
      // /auth/me returns snake_case — normalise the fields the app relies on
      setUser({
        ...u,
        restaurantId: u.restaurantId ?? u.restaurant_id,
        isSuperAdmin: u.is_super_admin ?? false,
      })
    } catch (error) {
      // Token invalid, clear it
      localStorage.removeItem('token')
      setToken(null)
      setAuthToken(null)
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (email: string, password: string) => {
    try {
      const response = await api.post('/auth/login', { email, password })
      const { token: newToken } = response.data.data

      setToken(newToken)
      localStorage.setItem('token', newToken)
      setAuthToken(newToken)

      // Fetch full profile (includes is_super_admin flag) rather than using
      // the partial user object from the login response.
      await fetchUserProfile()
    } catch (error) {
      throw error
    }
  }

  const logout = () => {
    setUser(null)
    setToken(null)
    setCurrentRestaurantName(null)
    localStorage.removeItem('token')
    localStorage.removeItem('restaurantName')
    setAuthToken(null)
  }

  const switchRestaurant = async (restaurantId: string, restaurantName: string) => {
    const response = await api.post('/organizations/switch-restaurant', { restaurant_id: restaurantId })
    const { token: newToken } = response.data.data

    setToken(newToken)
    setCurrentRestaurantName(restaurantName)
    localStorage.setItem('token', newToken)
    localStorage.setItem('restaurantName', restaurantName)
    setAuthToken(newToken)

    // Update user with the new restaurant context
    if (user) {
      setUser({ ...user, restaurantId })
    }

    // Reload features context for the new restaurant
    window.location.reload()
  }

  const value: AuthContextType = {
    user,
    token,
    login,
    logout,
    switchRestaurant,
    isAuthenticated: !!user,
    isLoading,
    currentRestaurantName,
    setCurrentRestaurantName,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}