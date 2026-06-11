import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'

interface TokenOrder {
  id: string
  token_number: string
  status: 'PREPARING' | 'READY'
  order_number: string
}

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1') as string

const TokenDisplay: React.FC = () => {
  const [searchParams] = useSearchParams()
  const slug = searchParams.get('slug') || ''
  const [restaurantName, setRestaurantName] = useState('')
  const [orders, setOrders] = useState<TokenOrder[]>([])
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const restaurantIdRef = useRef<string | null>(null)

  const fetchOrders = useCallback(async () => {
    const rId = restaurantIdRef.current
    if (!rId) return
    try {
      const res = await fetch(`${API_BASE}/public/tokens/${rId}`)
      if (!res.ok) return
      const data = await res.json()
      const tokenOrders: TokenOrder[] = (data?.data || [])
        .filter((o: any) => o.token_number)
        .sort((a: any, b: any) => {
          if (a.status === 'READY' && b.status !== 'READY') return -1
          if (b.status === 'READY' && a.status !== 'READY') return 1
          return a.token_number.localeCompare(b.token_number)
        })
      setOrders(tokenOrders)
      setLastUpdated(new Date())
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    if (!slug) { setError('Missing ?slug= parameter'); return }
    fetch(`${API_BASE}/public/menu/${slug}`)
      .then(r => r.json())
      .then(data => {
        const r = data?.data?.restaurant
        if (!r) { setError('Restaurant not found'); return }
        setRestaurantName(r.name)
        restaurantIdRef.current = r.id
      })
      .catch(() => setError('Failed to load restaurant'))
  }, [slug])

  useEffect(() => {
    if (!restaurantName) return
    fetchOrders()
    const t = setInterval(fetchOrders, 10000)
    return () => clearInterval(t)
  }, [restaurantName, fetchOrders])

  const readyOrders = orders.filter(o => o.status === 'READY')
  const preparingOrders = orders.filter(o => o.status === 'PREPARING')
  const tokenNum = (t: string) => t.includes('-') ? t.split('-').slice(1).join('-') : t

  if (error) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <p className="text-red-400 text-xl mb-2">{error}</p>
        <p className="text-gray-500 text-sm">URL format: /display?slug=your-restaurant</p>
      </div>
    </div>
  )

  if (!restaurantName) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-10 h-10 rounded-full border-2 border-gray-700 border-t-indigo-500 animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col select-none">
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold">{restaurantName}</h1>
          <p className="text-gray-400 text-sm mt-0.5">Token Display</p>
        </div>
        <p className="text-gray-600 text-xs">Updated {lastUpdated.toLocaleTimeString()}</p>
      </header>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 p-6">
          <div className="flex items-center gap-3 mb-5">
            <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
            <h2 className="text-emerald-400 text-xl font-bold uppercase tracking-widest">Ready to Collect</h2>
            <span className="bg-emerald-900 text-emerald-300 text-sm font-bold px-3 py-0.5 rounded-full">{readyOrders.length}</span>
          </div>
          {readyOrders.length === 0 ? (
            <div className="flex items-center justify-center h-40 border-2 border-dashed border-gray-800 rounded-2xl">
              <p className="text-gray-600 text-xl">No orders ready yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
              {readyOrders.map(o => (
                <div key={o.id} className="bg-emerald-950 border-2 border-emerald-500 rounded-2xl p-5 text-center">
                  <p className="text-5xl font-black text-emerald-300 leading-none tracking-tight">{tokenNum(o.token_number)}</p>
                  <p className="text-emerald-600 text-xs mt-2">{o.token_number}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {preparingOrders.length > 0 && (
          <>
            <div className="border-t border-gray-800 mx-6" />
            <div className="px-6 py-4 shrink-0">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <h2 className="text-amber-400 text-sm font-bold uppercase tracking-widest">Preparing</h2>
                <span className="bg-amber-950 text-amber-400 text-xs font-bold px-2.5 py-0.5 rounded-full">{preparingOrders.length}</span>
              </div>
              <div className="flex flex-wrap gap-3">
                {preparingOrders.map(o => (
                  <div key={o.id} className="bg-amber-950 border border-amber-800 rounded-xl px-5 py-3 text-center">
                    <p className="text-2xl font-bold text-amber-300 leading-none">{tokenNum(o.token_number)}</p>
                    <p className="text-amber-700 text-xs mt-1">{o.token_number}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <footer className="bg-gray-900 border-t border-gray-800 px-6 py-2 flex justify-between shrink-0">
        <p className="text-gray-600 text-xs">AuraOS · Token Display</p>
        <p className="text-gray-600 text-xs">Please collect your order when your token appears above</p>
      </footer>
    </div>
  )
}

export default TokenDisplay
