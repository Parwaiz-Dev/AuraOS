import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './store/useAuthStore'
import { useMenuStore } from './store/useMenuStore'
import LoginPage    from './pages/LoginPage'
import TablesPage   from './pages/TablesPage'
import OrderPage    from './pages/OrderPage'
import MyOrdersPage from './pages/MyOrdersPage'
import BottomNav    from './components/BottomNav'
import OfflineBanner from './components/OfflineBanner'

// ── Protected wrapper ─────────────────────────────────────────────────────────
const Protected: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-gray-200 border-t-indigo-600 animate-spin" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

// ── Layout with bottom nav ────────────────────────────────────────────────────
const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen pb-20">
    <OfflineBanner />
    {children}
    <BottomNav />
  </div>
)

// ── App ───────────────────────────────────────────────────────────────────────
const App: React.FC = () => {
  const { restoreSession } = useAuthStore()
  const { fetchAll } = useMenuStore()

  useEffect(() => {
    restoreSession().then(() => fetchAll())
  }, [restoreSession, fetchAll])

  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route path="/" element={
          <Protected>
            <AppLayout><TablesPage /></AppLayout>
          </Protected>
        } />

        <Route path="/orders" element={
          <Protected>
            <AppLayout><MyOrdersPage /></AppLayout>
          </Protected>
        } />

        {/* New order */}
        <Route path="/order/new" element={
          <Protected>
            <OrderPage />
          </Protected>
        } />

        {/* Add items to existing order */}
        <Route path="/order/add/:orderId" element={
          <Protected>
            <OrderPage />
          </Protected>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#1f2937',
            color: '#f9fafb',
            fontSize: '14px',
            borderRadius: '12px',
          },
        }}
      />
    </>
  )
}

export default App
