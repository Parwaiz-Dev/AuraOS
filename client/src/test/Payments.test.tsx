import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import axios from 'axios'
import Payments from '@/pages/Payments'

vi.mock('axios')
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { name: 'Admin User' },
    isAuthenticated: true,
  })
}))
vi.mock('@/contexts/SocketContext', () => ({
  useSocket: () => ({
    socket: null,
    isConnected: false,
  })
}))

const mockAxios = axios as any
const mockFetch = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  mockAxios.get.mockImplementation((url: string) => {
    if (url === '/api/v1/payments') {
      return Promise.resolve({
        data: {
          data: [
            {
              id: 'payment-1',
              restaurant_id: 'rest-1',
              order_id: 'order-1',
              amount: 120.5,
              method: 'CARD',
              status: 'PAID',
              reference_number: 'REF123',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
        },
      })
    }

    if (url === '/api/v1/orders') {
      return Promise.resolve({
        data: {
          data: [
            {
              id: 'order-1',
              restaurant_id: 'rest-1',
              table_id: 'table-1',
              order_number: 'ORD-001',
              order_type: 'DINE_IN',
              order_source: 'WAITER',
              status: 'CREATED',
              total_amount: 120.5,
              priority_score: 0,
              created_by: 'user-1',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              completed_at: null,
            },
          ],
        },
      })
    }

    return Promise.resolve({ data: { data: [] } })
  })

  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ data: { total_amount: 120.5 } }),
  })
  vi.stubGlobal('fetch', mockFetch)
})

describe('Payments Page', () => {
  it('renders payments heading and table rows', async () => {
    render(<Payments />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /payments/i })).toBeInTheDocument()
    })

    expect(screen.getByText(/manage payments and track transactions/i)).toBeInTheDocument()
    expect(screen.getByText(/payment-/i)).toBeInTheDocument()
    expect(screen.getByText('₹120.50')).toBeInTheDocument()
  })

  it('disables create button until an order is selected', async () => {
    render(<Payments />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create payment/i })).toBeDisabled()
    })

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'order-1' } })
    expect(screen.getByRole('button', { name: /create payment/i })).toBeEnabled()
  })
})
