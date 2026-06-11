/**
 * useReadyNotifications
 *
 * Global hook that listens for real-time order updates and alerts staff
 * (waiters / reception) whenever an order becomes READY to serve.
 *
 * What it does:
 *   - Subscribes to the ORDER_UPDATED socket event.
 *   - When an order transitions INTO the READY state, it:
 *       1. Shows a prominent toast ("🔔 Order ready to serve").
 *       2. Plays a short notification beep (Web Audio API — no asset needed).
 *
 * It tracks the last-seen status per order id so it only fires ONCE per
 * transition (the kitchen may emit several updates for the same order).
 *
 * Mount this once, high in the tree (e.g. inside Layout) so the alert works
 * on every screen, not just the Tables page.
 */
import { useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { useSocket } from '../contexts/SocketContext'

interface OrderUpdatePayload {
  order_id: string
  status: string
  table_id?: string | null
  total_amount?: number
}

/**
 * Plays a short two-tone "ding" using the Web Audio API.
 * Avoids shipping an audio file and works offline.
 */
function playReadyChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const notes = [880, 1175] // A5 then D6 — pleasant rising chime
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      osc.connect(gain)
      gain.connect(ctx.destination)
      const start = ctx.currentTime + i * 0.18
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.3, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16)
      osc.start(start)
      osc.stop(start + 0.18)
    })
    // Close the context shortly after to free resources
    setTimeout(() => ctx.close().catch(() => {}), 800)
  } catch {
    /* Audio not available — fail silently, the toast still shows */
  }
}

export function useReadyNotifications() {
  const { socket } = useSocket()
  // Remembers the last status we saw for each order so we only alert on the
  // CREATED/PREPARING → READY transition (not on repeated READY broadcasts).
  const lastStatus = useRef<Record<string, string>>({})

  useEffect(() => {
    if (!socket) return

    const onUpdate = (payload: OrderUpdatePayload) => {
      if (!payload?.order_id) return
      const prev = lastStatus.current[payload.order_id]
      lastStatus.current[payload.order_id] = payload.status

      if (payload.status === 'READY' && prev !== 'READY') {
        playReadyChime()
        toast.success('🔔 An order is ready to serve!', {
          duration: 6000,
          style: { fontWeight: 600 },
        })
      }
    }

    socket.on('ORDER_UPDATED', onUpdate)
    return () => {
      socket.off('ORDER_UPDATED', onUpdate)
    }
  }, [socket])
}
