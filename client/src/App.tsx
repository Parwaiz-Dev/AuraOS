import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { SocketProvider } from './contexts/SocketContext'
import { AppStoreProvider } from './contexts/AppStore'
import { SubscriptionProvider } from './contexts/SubscriptionContext'
import { FeaturesProvider } from './contexts/FeaturesContext'
import LandingPage from './pages/LandingPage'
import Login from './pages/Login'
import Register from './pages/Register'
import PasswordReset from './pages/PasswordReset'
import Dashboard from './pages/Dashboard'
import Orders from './pages/Orders'
import Tables from './pages/Tables'
import Menu from './pages/Menu'
import Reports from './pages/Reports'
import Payments from './pages/Payments'
import OrderDetails from './pages/OrderDetails'
import Kitchen from './pages/Kitchen'
import Users from './pages/Users'
import Modifiers from './pages/Modifiers'
import Inventory from './pages/Inventory'
import CustomerApp from './pages/CustomerApp'
import TokenDisplay from './pages/TokenDisplay'
import QRSettings from './pages/QRSettings'
import NotFound from './pages/NotFound'
import Onboarding from './pages/Onboarding'
import ZomatoSettings from './pages/ZomatoSettings'
import Subscription from './pages/Subscription'
import OwnerDashboard from './pages/OwnerDashboard'
import MultiOutlet from './pages/MultiOutlet'
import Reservations from './pages/Reservations'
import DeliveryZones from './pages/DeliveryZones'
import Coupons from './pages/Coupons'
import Reviews from './pages/Reviews'
import Loyalty from './pages/Loyalty'
import Features from './pages/Features'
import Monitoring from './pages/Monitoring'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'

function App() {
  return (
    <AuthProvider>
      <AppStoreProvider>
        <SocketProvider>
          <SubscriptionProvider>
            <FeaturesProvider>
            <div className="min-h-screen bg-gray-50">
              <Routes>
              {/* Public marketing landing page */}
              <Route path="/" element={<LandingPage />} />

              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/password-reset" element={<PasswordReset />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/customer" element={<CustomerApp />} />
              <Route path="/display" element={<TokenDisplay />} />
              
              {/* Kitchen Display System - Full Screen, no layout */}
              <Route path="/kitchen" element={
                <ProtectedRoute>
                  <Kitchen />
                </ProtectedRoute>
              } />

              {/* Main Application Routes */}
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/orders" element={
                <ProtectedRoute>
                  <Layout>
                    <Orders />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/tables" element={
                <ProtectedRoute>
                  <Layout>
                    <Tables />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/menu" element={
                <ProtectedRoute>
                  <Layout>
                    <Menu />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/payments" element={
                <ProtectedRoute>
                  <Layout>
                    <Payments />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/inventory" element={
                <ProtectedRoute roles={['ADMIN']}>
                  <Layout>
                    <Inventory />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/users" element={
                <ProtectedRoute roles={['ADMIN']}>
                  <Layout>
                    <Users />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/reports" element={
                <ProtectedRoute roles={['ADMIN']}>
                  <Layout>
                    <Reports />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/qr-settings" element={
                <ProtectedRoute roles={['ADMIN']}>
                  <Layout>
                    <QRSettings />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/zomato-settings" element={
                <ProtectedRoute roles={['ADMIN']}>
                  <Layout>
                    <ZomatoSettings />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/subscription" element={
                <ProtectedRoute roles={['ADMIN']}>
                  <Layout>
                    <Subscription />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/features" element={
                <ProtectedRoute roles={['ADMIN']}>
                  <Layout>
                    <Features />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/modifiers" element={
                <ProtectedRoute roles={['ADMIN']}>
                  <Layout>
                    <Modifiers />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/owner" element={
                <ProtectedRoute superAdminOnly>
                  <Layout>
                    <OwnerDashboard />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/multi-outlet" element={
                <ProtectedRoute superAdminOnly>
                  <Layout>
                    <MultiOutlet />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/reservations" element={
                <ProtectedRoute>
                  <Layout>
                    <Reservations />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/delivery-zones" element={
                <ProtectedRoute roles={['ADMIN']}>
                  <Layout>
                    <DeliveryZones />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/coupons" element={
                <ProtectedRoute roles={['ADMIN']}>
                  <Layout>
                    <Coupons />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/reviews" element={
                <ProtectedRoute roles={['ADMIN']}>
                  <Layout>
                    <Reviews />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/loyalty" element={
                <ProtectedRoute roles={['ADMIN']}>
                  <Layout>
                    <Loyalty />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/orders/:id" element={
                <ProtectedRoute>
                  <Layout>
                    <OrderDetails />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/owner/monitoring" element={
                <ProtectedRoute superAdminOnly>
                  <Layout>
                    <Monitoring />
                  </Layout>
                </ProtectedRoute>
              } />

              {/* 404 — catch all unmatched routes */}
              <Route path="*" element={<NotFound />} />
              </Routes>
            </div>
          </FeaturesProvider>
          </SubscriptionProvider>
        </SocketProvider>
      </AppStoreProvider>
    </AuthProvider>
  )
}

export default App