import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authApi } from '../api/endpoints'
import { setToken } from '../api/client'
import type { User } from '../types'

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  restoreSession: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user:      null,
      token:     null,
      isLoading: false,

      login: async (email, password) => {
        set({ isLoading: true })
        try {
          const res = await authApi.login(email, password)
          const { token, user } = res.data.data
          setToken(token)
          set({ token, user: { ...user, restaurantId: user.restaurant_id }, isLoading: false })
        } catch (err) {
          set({ isLoading: false })
          throw err
        }
      },

      logout: () => {
        setToken(null)
        set({ user: null, token: null })
      },

      restoreSession: async () => {
        const { token } = get()
        if (!token) return
        setToken(token)
        try {
          const res = await authApi.me()
          const user = res.data.data
          set({ user: { ...user, restaurantId: user.restaurant_id } })
        } catch {
          setToken(null)
          set({ user: null, token: null })
        }
      },
    }),
    {
      name: 'waiter-auth',
      partialize: (state) => ({ token: state.token, user: state.user }),
    },
  ),
)
