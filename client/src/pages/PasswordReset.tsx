import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import api, { getErrorMessage } from '../api'
import Button from '../components/Button'
import Input from '../components/Input'
import { CheckCircleIcon } from '@heroicons/react/24/outline'

const PasswordReset: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Step 1: user enters email → we send the reset email
  // Step 2: user enters token (from email) + new password
  const [step, setStep] = useState<'email' | 'reset'>('email')

  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  // If the user clicked the link in the email, the token is in the URL
  // e.g. /password-reset?token=abc123
  useEffect(() => {
    const urlToken = searchParams.get('token')
    if (urlToken) {
      setToken(urlToken)
      setStep('reset')
    }
  }, [searchParams])

  // ── Step 1: request reset email ──────────────────────────────────────────
  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    try {
      await api.post('/auth/reset-password', { email })
      // Always show success — backend never reveals if email exists
      setStep('reset')
      toast.success('Check your email for the reset token')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2: confirm reset with token + new password ──────────────────────
  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    setLoading(true)
    try {
      await api.post('/auth/confirm-reset', { token, password })
      setDone(true)
      toast.success('Password reset successfully')
      setTimeout(() => navigate('/login'), 2500)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  // ── Success screen ────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircleIcon className="w-9 h-9 text-emerald-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Password updated</h2>
          <p className="text-sm text-gray-500">Redirecting to login…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="bg-indigo-600 px-6 py-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mx-auto mb-3">
            <span className="text-white font-bold text-xl">A</span>
          </div>
          <h1 className="text-xl font-bold text-white">Reset Password</h1>
          <p className="text-indigo-200 text-sm mt-1">
            {step === 'email' ? 'Enter your email to get a reset link' : 'Enter the token from your email'}
          </p>
        </div>

        <div className="p-6">
          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-6">
            <div className={`flex-1 h-1.5 rounded-full ${step === 'email' ? 'bg-indigo-600' : 'bg-indigo-200'}`} />
            <div className={`flex-1 h-1.5 rounded-full ${step === 'reset' ? 'bg-indigo-600' : 'bg-gray-200'}`} />
          </div>

          {step === 'email' ? (
            <form onSubmit={handleRequestReset} className="space-y-4">
              <Input
                label="Email Address"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                fullWidth
              />
              <Button type="submit" variant="primary" fullWidth isLoading={loading}>
                Send Reset Email
              </Button>
              <p className="text-xs text-gray-400 text-center">
                We'll send a reset token to your email. Check your spam folder if you don't see it.
              </p>
            </form>
          ) : (
            <form onSubmit={handleConfirmReset} className="space-y-4">
              <Input
                label="Reset Token"
                type="text"
                placeholder="Paste token from email"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                hint="Check your email for the 64-character token"
                required
                fullWidth
              />
              <Input
                label="New Password"
                type="password"
                placeholder="Min 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                fullWidth
              />
              <Input
                label="Confirm Password"
                type="password"
                placeholder="Repeat new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                error={
                  confirmPassword && password !== confirmPassword
                    ? 'Passwords do not match'
                    : undefined
                }
                required
                fullWidth
              />
              <Button type="submit" variant="primary" fullWidth isLoading={loading}>
                Reset Password
              </Button>
              <button
                type="button"
                onClick={() => setStep('email')}
                className="w-full text-sm text-gray-500 hover:text-gray-700 text-center"
              >
                ← Request a new token
              </button>
            </form>
          )}

          <div className="mt-5 text-center">
            <Link to="/login" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PasswordReset
