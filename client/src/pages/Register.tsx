import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api, { getErrorMessage, setAuthToken } from '../api'
import { CheckCircleIcon, ArrowRightIcon } from '@heroicons/react/24/outline'

const Register: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()

  const validateForm = () => {
    if (!name.trim()) {
      setError('Name is required')
      return false
    }
    if (!email.trim()) {
      setError('Email is required')
      return false
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return false
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return false
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!validateForm()) return

    setIsLoading(true)

    try {
      const response = await api.post('/onboarding/register', {
        restaurant_name: name,
        admin_name: name,
        admin_email: email,
        admin_password: password
      })

      const { token } = response.data.data
      if (token) {
        localStorage.setItem('token', token)
        setAuthToken(token)
      }

      setSuccess(true)
      setTimeout(() => {
        navigate('/dashboard')
      }, 2000)
    } catch (err: any) {
      setError(getErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#030712] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-md">
          <CheckCircleIcon className="w-16 h-16 text-[#06b6d4] mx-auto mb-6" />
          <h2 className="text-3xl font-bold text-white mb-2">Account Created!</h2>
          <p className="text-slate-400 mb-8">
            Your account has been successfully created. Redirecting to dashboard...
          </p>
          <div className="w-5 h-5 border-2 border-[#3b82f6] border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#030712] text-white font-sans relative overflow-hidden">
      {/* Floating gradient blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-48 left-1/4 w-[600px] h-[600px] bg-[#3b82f6]/20 rounded-full blur-[140px] animate-pulse" />
        <div className="absolute top-1/3 -right-24 w-[500px] h-[500px] bg-[#8b5cf6]/18 rounded-full blur-[130px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute -bottom-48 left-1/3 w-[450px] h-[450px] bg-[#ec4899]/12 rounded-full blur-[120px] animate-pulse" />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col lg:flex-row">
        {/* LEFT SIDE — Features */}
        <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group mb-16">
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6] flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-[#3b82f6]/25">A</span>
            <span className="text-lg font-bold tracking-tight">Aura<span className="text-[#3b82f6]">OS</span></span>
          </Link>

          {/* Headline & Description */}
          <div>
            <h1 className="text-5xl font-bold mb-6 leading-tight">
              <span className="text-white">Start Your</span>
              <br />
              <span className="bg-gradient-to-r from-[#3b82f6] via-[#8b5cf6] to-[#ec4899] bg-clip-text text-transparent">
                14-Day Free Trial
              </span>
            </h1>
            <p className="text-lg text-slate-400 leading-relaxed mb-12 max-w-md">
              Run QSRs, Cafés, Full-Service Restaurants, Cloud Kitchens and Multi-Outlet Chains with AuraOS.
            </p>

            {/* Features */}
            <div className="space-y-3.5">
              {[
                'Kitchen Display',
                'QR Ordering',
                'Payments',
                'Inventory',
                'Reports',
                'Waiter App'
              ].map((feature) => (
                <div key={feature} className="flex items-center gap-3">
                  <CheckCircleIcon className="w-5 h-5 text-[#06b6d4] flex-shrink-0" />
                  <span className="text-slate-300">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <p className="text-slate-500 text-sm">© 2026 AuraOS. All rights reserved.</p>
        </div>

        {/* RIGHT SIDE — Registration Form */}
        <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
          <div className="w-full max-w-md">
            {/* Mobile logo */}
            <Link to="/" className="lg:hidden flex items-center gap-2.5 mb-8">
              <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6] flex items-center justify-center text-white font-bold text-sm">A</span>
              <span className="text-lg font-bold">Aura<span className="text-[#3b82f6]">OS</span></span>
            </Link>

            {/* Glass card */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-8 sm:p-10">
              <h2 className="text-2xl font-bold text-white mb-1">Create Account</h2>
              <p className="text-slate-400 text-sm mb-8">Join AuraOS and start your free trial</p>

              <form className="space-y-4" onSubmit={handleSubmit}>
                {/* Full Name */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Full Name</label>
                  <input
                    type="text"
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-[#3b82f6]/50 focus:bg-white/[0.08] transition-all"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
                  <input
                    type="email"
                    placeholder="you@restaurant.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-[#3b82f6]/50 focus:bg-white/[0.08] transition-all"
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
                  <input
                    type="password"
                    placeholder="Enter password (min 6 characters)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-[#3b82f6]/50 focus:bg-white/[0.08] transition-all"
                  />
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Confirm Password</label>
                  <input
                    type="password"
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`w-full px-4 py-2.5 rounded-lg bg-white/5 border text-white placeholder-slate-500 focus:outline-none focus:bg-white/[0.08] transition-all ${
                      password !== confirmPassword && confirmPassword ? 'border-red-500/50 focus:border-red-500/50' : 'border-white/10 focus:border-[#3b82f6]/50'
                    }`}
                  />
                </div>

                {/* Error */}
                {error && (
                  <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 mt-6 px-6 py-3 rounded-lg bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6] text-white font-semibold text-sm hover:shadow-lg hover:shadow-[#3b82f6]/30 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      Create Account
                      <ArrowRightIcon className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Sign In Link */}
              <div className="mt-6 text-center">
                <p className="text-sm text-slate-400">
                  Already have an account?{' '}
                  <Link to="/login" className="text-[#3b82f6] hover:text-[#3b82f6]/80 font-medium transition-colors">
                    Sign In
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Register
