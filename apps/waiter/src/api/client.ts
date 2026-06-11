/**
 * Axios client for the Waiter App.
 *
 * - Attaches JWT token from localStorage on every request
 * - On 401: clears token and redirects to login
 * - Retries once on 5xx errors
 * - Throws structured errors so stores can handle them cleanly
 */

import axios, { AxiosError } from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1'

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

// ── Request interceptor — attach token ───────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('waiter_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Response interceptor — handle errors ─────────────────────────────────────
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as any

    if (error.response?.status === 401) {
      localStorage.removeItem('waiter_token')
      window.location.href = '/login'
      return Promise.reject(error)
    }

    // Retry once on server errors
    if (error.response?.status && error.response.status >= 500 && !original._retry) {
      original._retry = true
      return api(original)
    }

    return Promise.reject(error)
  },
)

export function getErrorMessage(err: any): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.error?.message || err.message || 'Request failed'
  }
  return String(err)
}

export function setToken(token: string | null) {
  if (token) {
    localStorage.setItem('waiter_token', token)
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`
  } else {
    localStorage.removeItem('waiter_token')
    delete api.defaults.headers.common['Authorization']
  }
}
