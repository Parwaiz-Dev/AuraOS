import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/useAuthStore'
import { getErrorMessage } from '../api/client'

const LoginPage: React.FC = () => {
  const [email, setEmail]       = useState('waiter@demo-kitchen.local')
  const [password, setPassword] = useState('demo123')
  const { login, isLoading }    = useAuthStore()
  const navigate                = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="bg-indigo-600 px-8 py-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-3xl">A</span>
          </div>
          <h1 className="text-2xl font-bold text-white">AuraOS Waiter</h1>
          <p className="text-indigo-200 text-sm mt-1">Sign in to start taking orders</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="your@email.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="Password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary w-full mt-2 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            ) : 'Sign In'}
          </button>

          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-400 mb-1">Demo credentials</p>
            <p className="text-xs font-mono text-gray-600">waiter@demo-kitchen.local / demo123</p>
          </div>
        </form>
      </div>
    </div>
  )
}

export default LoginPage
