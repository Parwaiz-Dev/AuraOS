/**
 * SubscriptionContext — loads the current restaurant's subscription once and
 * shares it across the app (banner, settings page, write-gating UI hints).
 *
 * It refetches on demand (after a plan change / invoice payment) via refresh().
 * Read-only state (SUSPENDED / CANCELLED) is exposed as `isReadOnly` so screens
 * can disable create/modify actions before the API even rejects them.
 */
import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { subscriptionApi } from '../api'
import { useAuth } from './AuthContext'
import { SubscriptionView } from '../types/subscription'

interface SubscriptionContextType {
  subscription: SubscriptionView | null
  loading: boolean
  isReadOnly: boolean
  refresh: () => Promise<void>
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined)

export const useSubscription = () => {
  const ctx = useContext(SubscriptionContext)
  if (!ctx) throw new Error('useSubscription must be used within a SubscriptionProvider')
  return ctx
}

export const SubscriptionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth()
  const [subscription, setSubscription] = useState<SubscriptionView | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) {
      setSubscription(null)
      setLoading(false)
      return
    }
    try {
      const res = await subscriptionApi.getMine()
      setSubscription(res.data.data)
    } catch {
      // Non-fatal — leave subscription null, app still usable
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { refresh() }, [refresh])

  const isReadOnly =
    subscription?.status === 'SUSPENDED' || subscription?.status === 'CANCELLED'

  return (
    <SubscriptionContext.Provider value={{ subscription, loading, isReadOnly, refresh }}>
      {children}
    </SubscriptionContext.Provider>
  )
}
