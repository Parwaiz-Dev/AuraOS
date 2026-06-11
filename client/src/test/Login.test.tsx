import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { SocketProvider } from '@/contexts/SocketContext'
import Login from '@/pages/Login'

const MockedLogin = () => (
  <BrowserRouter>
    <AuthProvider>
      <SocketProvider>
        <Login />
      </SocketProvider>
    </AuthProvider>
  </BrowserRouter>
)

describe('Login Page', () => {
  it('renders login form', () => {
    render(<MockedLogin />)
    expect(screen.getByText(/sign in to auraos/i)).toBeInTheDocument()
  })

  it('displays email and password fields', () => {
    render(<MockedLogin />)
    expect(screen.getByPlaceholderText(/email address/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/password/i)).toBeInTheDocument()
  })

  it('displays sign in button', () => {
    render(<MockedLogin />)
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('shows demo credentials help text', () => {
    render(<MockedLogin />)
    expect(screen.getByText(/admin@demo-kitchen.local/i)).toBeInTheDocument()
  })
})