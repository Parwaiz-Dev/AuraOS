/**
 * useOfflineSync — drains the offline order queue when connectivity is restored.
 *
 * Listens to the browser's online/offline events.
 * When the device comes back online, calls drainQueue() to submit
 * any orders that were saved while offline.
 *
 * Also shows a toast notification so the waiter knows their queued
 * orders are being synced.
 */

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useOrderStore } from '../store/useOrderStore'

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const { queue, drainQueue } = useOrderStore()

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true)
      if (queue.length > 0) {
        toast.loading(`Syncing ${queue.length} queued order(s)…`, { id: 'sync' })
        await drainQueue()
        toast.success('Orders synced!', { id: 'sync' })
      } else {
        toast.success('Back online', { id: 'online', duration: 2000 })
      }
    }

    const handleOffline = () => {
      setIsOnline(false)
      toast.error('You are offline — orders will be queued', {
        id: 'offline',
        duration: 5000,
      })
    }

    window.addEventListener('online',  handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online',  handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [queue, drainQueue])

  return { isOnline, queueLength: queue.length }
}
