import { useState, useEffect, useCallback } from 'react'

interface UseAIQueryResult<T> {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useAIQuery<T>(
  fetcher: () => Promise<{ data: T }>,
  deps: unknown[] = [],
): UseAIQueryResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetcher()
      setData(res.data)
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to fetch data'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, deps)

  useEffect(() => {
    fetch()
  }, [fetch])

  return { data, loading, error, refetch: fetch }
}

export function useAIPolling<T>(
  fetcher: () => Promise<{ data: T }>,
  intervalMs: number,
  deps: unknown[] = [],
): UseAIQueryResult<T> {
  const result = useAIQuery(fetcher, deps)

  useEffect(() => {
    const id = setInterval(result.refetch, intervalMs)
    return () => clearInterval(id)
  }, [result.refetch, intervalMs])

  return result
}
