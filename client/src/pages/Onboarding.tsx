/**
 * Onboarding — new restaurant registration.
 *
 * Creates a restaurant + admin account in one step.
 * On success, logs the admin in and redirects to the dashboard.
 *
 * Accessible at /onboarding (no login required).
 * Linked from the Login page.
 */

import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'
import { getErrorMessage } from '../api'
import Button from '../components/Button'
import Input from '../components/Input'
import {
  BuildingStorefrontIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'

// Standalone axios — no auth interceptor needed for this public endpoint
const publicApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  timeout: 15000,
})

type Step = 'restaurant' | 'admin' | 'done'

const FEATURES = [
  { icon: '🍽️', text: 'Table & order management' },
  { icon: '👨‍🍳', text: 'Real-time kitchen display' },
  { icon: '📱', text: 'QR ordering for customers' },
  { icon: '📊', text: 'Revenue & analytics' },
  { icon: '💳', text: 'Payment tracking' },
  { icon: '📦', text: 'Inventory management' },
]

const Onboarding: React.FC = () => {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [step, setStep] = useState<Step>('restaurant')
  const [loading, setLoading] = useState(false)

  // Step 1 — restaurant
  const [restaurantName, setRestaurantName] = useState('')
  const [qrMode, setQrMode] = useState<'restaurant' | 'mall'>('restaurant')

  // Step 2 — admin
  const [adminName, setAdminName]       = useState('')
  const [adminEmail, setAdminEmail]     = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const handleRestaurantNext = (e: React.FormEvent) => {
    e.preventDefault()
    if (!restaurantName.trim()) { toast.error('Enter your restaurant name'); return }
    setStep('admin')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (adminPassword !== confirmPassword) { toast.error('Passwords do not match'); return }
    if (adminPassword.length < 8) { toast.error('Password must be at least 8 characters'); return }

    setLoading(true)
    try {
      const res = await publicApi.post('/onboarding/register', {
        restaurant_name:         restaurantName.trim(),
        admin_name:              adminName.trim(),
        admin_email:             adminEmail.trim().toLowerCase(),
        admin_password:          adminPassword,
        qr_mode:                 qrMode,
        delay_threshold_minutes: 15,
      })

      const { token } = res.data.data

      // Store token and set user — same as normal login
      localStorage.setItem('token', token)
      // Use the auth context login to set the user state
      await login(adminEmail, adminPassword)

      setStep('done')
      setTimeout(() => navigate('/dashboard'), 2000)
    } catch (err: any) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  // ── Success screen ──────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-sm w-full text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
            <CheckCircleIcon className="w-12 h-12 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">You're all set!</h1>
          <p className="text-gray-500 text-sm mb-2">
            <strong>{restaurantName}</strong> is ready.
          </p>
          <p className="text-gray-400 text-xs">Taking you to your dashboard…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel — features */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-600 to-purple-700 flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden bg-white/10">
            <img src="/icon-512.png" alt="AuraOS" className="w-full h-full object-cover" />
          </div>
          <span className="text-white font-bold text-xl">AuraOS</span>
        </div>
        <div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Set up your restaurant in 2 minutes
          </h1>
          <p className="text-indigo-200 text-lg mb-8">
            Everything you need to run a modern restaurant — orders, kitchen, payments, and more.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {FEATURES.map((f) => (
              <div key={f.text} className="flex items-center gap-2 text-indigo-100">
                <span className="text-xl">{f.icon}</span>
                <span className="text-sm">{f.text}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-indigo-300 text-sm">© 2026 AuraOS. All rights reserved.</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg overflow-hidden">
              <img src="/icon-512.png" alt="AuraOS" className="w-full h-full object-cover" />
            </div>
            <span className="font-bold text-gray-900 text-lg">AuraOS</span>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-8">
            <div className={`flex-1 h-1.5 rounded-full ${step === 'restaurant' || step === 'admin' ? 'bg-indigo-600' : 'bg-gray-200'}`} />
            <div className={`flex-1 h-1.5 rounded-full ${step === 'admin' ? 'bg-indigo-600' : 'bg-gray-200'}`} />
          </div>

          {/* Step 1 — Restaurant details */}
          {step === 'restaurant' && (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-1">Your restaurant</h2>
                <p className="text-gray-500 text-sm">Tell us about your restaurant</p>
              </div>

              <form onSubmit={handleRestaurantNext} className="space-y-4">
                <Input
                  label="Restaurant Name"
                  placeholder="e.g. Spice Garden, The Biryani House"
                  value={restaurantName}
                  onChange={(e) => setRestaurantName(e.target.value)}
                  leftIcon={<BuildingStorefrontIcon className="w-4 h-4" />}
                  required
                  fullWidth
                />

                <div>
                  <label className="form-label">QR Ordering Mode</label>
                  <div className="grid grid-cols-2 gap-3 mt-1">
                    <button
                      type="button"
                      onClick={() => setQrMode('restaurant')}
                      className={`p-3 text-left rounded-xl border-2 transition-colors ${
                        qrMode === 'restaurant'
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-xl">🍽️</span>
                      <p className="text-xs font-semibold text-gray-900 mt-1">Restaurant</p>
                      <p className="text-xs text-gray-400">Table selection</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setQrMode('mall')}
                      className={`p-3 text-left rounded-xl border-2 transition-colors ${
                        qrMode === 'mall'
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-xl">🛍️</span>
                      <p className="text-xs font-semibold text-gray-900 mt-1">Mall / Food Court</p>
                      <p className="text-xs text-gray-400">Name + payment</p>
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">You can change this later in QR Settings</p>
                </div>

                <Button type="submit" variant="primary" fullWidth size="lg">
                  Continue →
                </Button>
              </form>
            </>
          )}

          {/* Step 2 — Admin account */}
          {step === 'admin' && (
            <>
              <div className="mb-6">
                <button
                  onClick={() => setStep('restaurant')}
                  className="text-sm text-gray-400 hover:text-gray-600 mb-3 flex items-center gap-1"
                >
                  ← Back
                </button>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">Your admin account</h2>
                <p className="text-gray-500 text-sm">
                  This will be the owner account for <strong>{restaurantName}</strong>
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="Your Name"
                  placeholder="John Doe"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  required
                  fullWidth
                />
                <Input
                  label="Email"
                  type="email"
                  placeholder="you@restaurant.com"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  required
                  fullWidth
                />
                <Input
                  label="Password"
                  type="password"
                  placeholder="Min 8 characters"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  required
                  fullWidth
                />
                <Input
                  label="Confirm Password"
                  type="password"
                  placeholder="Repeat password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  error={
                    confirmPassword && adminPassword !== confirmPassword
                      ? 'Passwords do not match'
                      : undefined
                  }
                  required
                  fullWidth
                />

                <Button type="submit" variant="primary" fullWidth size="lg" isLoading={loading}>
                  Create Restaurant
                </Button>
              </form>
            </>
          )}

          <div className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link to="/login" className="text-indigo-600 hover:text-indigo-700 font-medium">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Onboarding
