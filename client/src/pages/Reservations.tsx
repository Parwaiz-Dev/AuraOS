/**
 * Reservations — owner/reception view of table-booking requests from the website.
 *
 * Bookings arrive PENDING and staff move them through CONFIRMED → COMPLETED, or
 * CANCELLED. New requests also arrive live via the RESERVATION_CREATED socket
 * event (the list refetches when one fires).
 */
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { getErrorMessage } from '../api'
import { useSocket } from '../contexts/SocketContext'
import { reservationApi, Reservation } from '../lib/growthApi'
import Card from '../components/Card'
import Button from '../components/Button'
import Loading from '../components/Loading'
import EmptyState from '../components/EmptyState'
import { CalendarDaysIcon } from '@heroicons/react/24/outline'

const STATUSES: Reservation['status'][] = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED']

const statusStyle: Record<Reservation['status'], string> = {
  PENDING: 'bg-amber-50 text-amber-700',
  CONFIRMED: 'bg-blue-50 text-blue-700',
  COMPLETED: 'bg-emerald-50 text-emerald-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
}

// Allowed forward transitions per status (mirrors the booking lifecycle).
const nextActions: Record<Reservation['status'], Reservation['status'][]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
}

export default function Reservations() {
  const [items, setItems] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('')
  const { socket } = useSocket()

  const load = useCallback(async () => {
    try {
      const res = await reservationApi.list(filter || undefined)
      setItems(res.data.data)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { load() }, [load])

  // Refetch when a new booking arrives live.
  useEffect(() => {
    if (!socket) return
    const handler = () => { toast.success('New booking received'); load() }
    socket.on('RESERVATION_CREATED', handler)
    return () => { socket.off('RESERVATION_CREATED', handler) }
  }, [socket, load])

  async function setStatus(id: string, status: Reservation['status']) {
    try {
      await reservationApi.updateStatus(id, status)
      toast.success(`Marked ${status.toLowerCase()}`)
      load()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Table Bookings</h1>
          <p className="text-sm text-gray-500">Reservations requested from your website.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterChip label="All" active={filter === ''} onClick={() => setFilter('')} />
        {STATUSES.map((s) => (
          <FilterChip key={s} label={s} active={filter === s} onClick={() => setFilter(s)} />
        ))}
      </div>

      {loading ? (
        <Loading />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<CalendarDaysIcon className="h-7 w-7" />}
          title="No bookings yet"
          description="Reservations from your website will appear here."
        />
      ) : (
        <div className="space-y-3">
          {items.map((r) => (
            <Card key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{r.customer_name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle[r.status]}`}>
                    {r.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-600">
                  {new Date(r.reserved_for).toLocaleString()} · {r.party_size} guests · {r.customer_phone}
                </p>
                {r.special_requests ? (
                  <p className="mt-1 text-sm italic text-gray-500">“{r.special_requests}”</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {nextActions[r.status].map((action) => (
                  <Button
                    key={action}
                    variant={action === 'CANCELLED' ? 'danger' : 'primary'}
                    onClick={() => setStatus(r.id, action)}
                  >
                    {action === 'CONFIRMED' ? 'Confirm' : action === 'COMPLETED' ? 'Complete' : 'Cancel'}
                  </Button>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-sm font-medium ${
        active ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-600 hover:border-gray-400'
      }`}
    >
      {label}
    </button>
  )
}
