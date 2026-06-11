import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getErrorMessage } from '../api'
import { ArrowRightIcon, SparklesIcon, BoltIcon, ChartBarIcon, ShieldCheckIcon } from '@heroicons/react/24/outline'

const Login: React.FC = () => {
  const [email, setEmail] = useState('admin@demo-kitchen.local')
  const [password, setPassword] = useState('demo1234')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err: any) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#030712] text-white font-sans relative overflow-hidden flex">
      {/* Floating gradient blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-48 left-1/4 w-[600px] h-[600px] bg-[#3b82f6]/20 rounded-full blur-[140px] animate-pulse" />
        <div className="absolute top-1/3 -right-24 w-[500px] h-[500px] bg-[#8b5cf6]/18 rounded-full blur-[130px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute -bottom-48 left-1/3 w-[450px] h-[450px] bg-[#ec4899]/12 rounded-full blur-[120px] animate-pulse" />
      </div>

      {/* LEFT SIDE — Features */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative z-10">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group mb-16">
          <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6] flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-[#3b82f6]/25">A</span>
          <span className="text-lg font-bold tracking-tight">Aura<span className="text-[#3b82f6]">OS</span></span>
        </Link>

        {/* Headline */}
        <div>
          <h1 className="text-5xl font-bold mb-6 leading-tight">
            <span className="text-white">Welcome Back</span>
            <br />
            <span className="bg-gradient-to-r from-[#3b82f6] via-[#8b5cf6] to-[#ec4899] bg-clip-text text-transparent">
              to AuraOS
            </span>
          </h1>
          <p className="text-lg text-slate-400 leading-relaxed mb-12 max-w-md">
            Sign in to your account and manage your restaurant with real-time ordering, kitchen display, and analytics.
          </p>

          {/* Features Grid */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: <SparklesIcon className="w-5 h-5" />, label: 'Real-time Orders' },
              { icon: <BoltIcon className="w-5 h-5" />, label: 'Kitchen Display' },
              { icon: <ChartBarIcon className="w-5 h-5" />, label: 'Smart Reports' },
              { icon: <ShieldCheckIcon className="w-5 h-5" />, label: 'Multi-role Access' },
            ].map((f) => (
              <div key={f.label} className="flex items-center gap-2 text-slate-300">
                <span className="text-[#3b82f6]">{f.icon}</span>
                <span className="text-sm font-medium">{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-slate-500 text-sm">© 2026 AuraOS. All rights reserved.</p>
      </div>

      {/* RIGHT SIDE — Login Form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 relative z-10">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <Link to="/" className="lg:hidden flex items-center gap-2.5 mb-8">
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6] flex items-center justify-center text-white font-bold text-sm">A</span>
            <span className="text-lg font-bold">Aura<span className="text-[#3b82f6]">OS</span></span>
          </Link>

          {/* Glass card */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-8 sm:p-10">
            <h2 className="text-2xl font-bold text-white mb-1">Welcome back</h2>
            <p className="text-slate-400 text-sm mb-8">Sign in to your account</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
                <input
                  type="email"
                  placeholder="you@restaurant.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-[#3b82f6]/50 focus:bg-white/[0.08] transition-all"
                  required
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
                <input
                  type="password"
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-[#3b82f6]/50 focus:bg-white/[0.08] transition-all"
                  required
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
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 mt-6 px-6 py-3 rounded-lg bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6] text-white font-semibold text-sm hover:shadow-lg hover:shadow-[#3b82f6]/30 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In
                    <ArrowRightIcon className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Links */}
            <div className="mt-6 flex items-center justify-between text-sm">
              <Link to="/register" className="text-[#3b82f6] hover:text-[#3b82f6]/80 font-medium transition-colors">
                Create account
              </Link>
              <Link to="/password-reset" className="text-slate-400 hover:text-slate-300 transition-colors">
                Forgot password?
              </Link>
            </div>

            {/* Demo Info */}
            <div className="mt-8 pt-6 border-t border-white/[0.06]">
              <p className="text-xs text-slate-500 font-medium mb-3">Demo Credentials (Pre-filled)</p>
              <div className="space-y-2 text-xs text-slate-400">
                <p className="font-mono">admin@demo-kitchen.local</p>
                <p className="font-mono">demo1234</p>
              </div>
            </div>

            {/* Register link */}
            <div className="mt-6 pt-4 border-t border-white/[0.06] text-center">
              <Link
                to="/register"
                className="text-sm text-[#3b82f6] hover:text-[#3b82f6]/80 font-medium transition-colors"
              >
                🏪 Register a new restaurant →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
