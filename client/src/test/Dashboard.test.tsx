import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import axios from 'axios'
import Dashboard from '@/pages/Dashboard'

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

describe('Dashboard Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAxios.get.mockResolvedValue({
      data: {
        data: {
          totalOrders: 10,
          activeOrders: 3,
          totalRevenue: 5000,
          occupiedTables: 2,
        }
      }
    })
  })

  it('renders dashboard heading', async () => {
    render(<Dashboard />)
    await waitFor(() => {
      expect(screen.getByText(/dashboard/i)).toBeInTheDocument()
    })
  })

  it('displays loading spinner while fetching', () => {
    render(<Dashboard />)
    const loader = screen.queryByRole('status') || document.querySelector('.animate-spin')
    expect(loader).toBeInTheDocument()
  })

  it('displays stats after loading', async () => {
    render(<Dashboard />)
    await waitFor(() => {
      expect(screen.getByText('Total Orders')).toBeInTheDocument()
    })
  })
})