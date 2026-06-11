/**
 * Menu store — caches categories + items.
 * Persisted to localStorage so the menu is available offline.
 * Refreshes from the API when online.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { menuApi, tablesApi } from '../api/endpoints'
import type { MenuItem, MenuCategory, Table } from '../types'

interface MenuState {
  categories: MenuCategory[]
  items: MenuItem[]
  tables: Table[]
  lastFetched: number | null
  isLoading: boolean
  error: string | null
  fetchAll: () => Promise<void>
}

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

export const useMenuStore = create<MenuState>()(
  persist(
    (set, get) => ({
      categories:  [],
      items:       [],
      tables:      [],
      lastFetched: null,
      isLoading:   false,
      error:       null,

      fetchAll: async () => {
        const { lastFetched } = get()
        const now = Date.now()

        // Skip if cache is fresh
        if (lastFetched && now - lastFetched < CACHE_TTL_MS) return

        set({ isLoading: true, error: null })
        try {
          const [catsRes, itemsRes, tablesRes] = await Promise.all([
            menuApi.categories(),
            menuApi.items(),
            tablesApi.list(),
          ])
          set({
            categories:  catsRes.data.data.filter((c) => c.is_active),
            items:       itemsRes.data.data.filter((i) => i.is_active),
            tables:      tablesRes.data.data.filter((t) => t.is_active),
            lastFetched: now,
            isLoading:   false,
          })
        } catch (err: any) {
          set({ isLoading: false, error: 'Failed to load menu' })
          // Don't throw — cached data is still usable offline
        }
      },
    }),
    {
      name: 'waiter-menu',
      partialize: (state) => ({
        categories:  state.categories,
        items:       state.items,
        tables:      state.tables,
        lastFetched: state.lastFetched,
      }),
    },
  ),
)
