import { useState, useCallback } from 'react'

import { getErrorMessage } from './api'

interface UseApiState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

export function useApi<T>(
  asyncFunction: () => Promise<T>,
  immediate = true
) {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: immediate,
    error: null
  })

  const execute = useCallback(async () => {
    setState({ data: null, loading: true, error: null })
    try {
      const response = await asyncFunction()
      setState({ data: response, loading: false, error: null })
      return response
    } catch (error: any) {
      const errorMessage = getErrorMessage(error)
      setState({ data: null, loading: false, error: errorMessage })
      throw error
    }
  }, [asyncFunction])

  return {
    ...state,
    execute,
    refetch: execute
  }
}
