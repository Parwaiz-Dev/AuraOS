import React, { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth, AvailableRestaurant } from '../contexts/AuthContext'
import { useSocket } from '../contexts/SocketContext'
import { useReadyNotifications } from '../hooks/useReadyNotifications'
import { useFeatures } from '../contexts/FeaturesContext'
import { NAV_TYPE_VISIBILITY } from '../config/restaurantTypes'
import type { RestaurantType } from '../config/restaurantTypes'
import SubscriptionBanner from './SubscriptionBanner'
import { getInitials } from '../lib/utils'
import api from '../api'
import {
  HomeIcon,
  ClipboardDocumentListIcon,
  TableCellsIcon,
  CalendarDaysIcon,
  MapPinIcon,
  BookOpenIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  UsersIcon,
  CubeIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  ExclamationCircleIcon,
  ComputerDesktopIcon,
  QrCodeIcon,
  BuildingStorefrontIcon,
  CreditCardIcon,
  GlobeAltIcon,
  Cog6ToothIcon,
  TagIcon,
  ChevronUpDownIcon,
  CheckIcon,
  SparklesIcon,
  ChatBubbleLeftRightIcon,
  PresentationChartLineIcon,
  UserGroupIcon,
  LightBulbIcon,
  ArchiveBoxIcon,
  ClockIcon,
  DocumentChartBarIcon,
  CpuChipIcon,
  BoltIcon,
  ArrowPathIcon,
  ShieldCheckIcon,
  CircleStackIcon,
  BookmarkSquareIcon,
  HeartIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline'
import { TicketIcon, StarIcon, GiftIcon } from '@heroicons/react/24/outline'
import { cn } from '../lib/utils'

interface NavItem {
  name: string
  href: string
  icon: React.ElementType
  roles?: string[]
  badge?: number
  superAdmin?: boolean
  featureKey?: string
  restaurantTypes?: RestaurantType[]
  section?: string
}

const navItems: NavItem[] = [
  { name: 'Dashboard',        href: '/dashboard',         icon: HomeIcon },
  { name: 'Orders',           href: '/orders',             icon: ClipboardDocumentListIcon },
  { name: 'Tables',           href: '/tables',             icon: TableCellsIcon,           restaurantTypes: NAV_TYPE_VISIBILITY['Tables'] },
  { name: 'Bookings',         href: '/reservations',       icon: CalendarDaysIcon },
  { name: 'Menu',             href: '/menu',               icon: BookOpenIcon },
  { name: 'Payments',         href: '/payments',           icon: CurrencyDollarIcon,       featureKey: 'payments' },
  { name: 'Kitchen Display',  href: '/kitchen',            icon: ComputerDesktopIcon,      featureKey: 'kitchen_display' },
  { name: 'Inventory',        href: '/inventory',          icon: CubeIcon,                 roles: ['ADMIN'], featureKey: 'inventory' },
  { name: 'Users',            href: '/users',              icon: UsersIcon,                roles: ['ADMIN'] },
  { name: 'Reports',          href: '/reports',            icon: ChartBarIcon,             roles: ['ADMIN'], featureKey: 'reports' },
  { name: 'QR Settings',      href: '/qr-settings',        icon: QrCodeIcon,               roles: ['ADMIN'], featureKey: 'qr_ordering', restaurantTypes: NAV_TYPE_VISIBILITY['QR Settings'] },
  { name: 'Delivery Zones',   href: '/delivery-zones',     icon: MapPinIcon,               roles: ['ADMIN'] },
  { name: 'Reservations',     href: '/reservations',       icon: CalendarDaysIcon },
  { name: 'Coupons',          href: '/coupons',            icon: TicketIcon,               roles: ['ADMIN'] },
  { name: 'Loyalty',          href: '/loyalty',            icon: GiftIcon,                 roles: ['ADMIN'] },
  { name: 'Reviews',          href: '/reviews',            icon: StarIcon,                 roles: ['ADMIN'] },
  { name: 'Modifiers',        href: '/modifiers',          icon: TagIcon,                  roles: ['ADMIN'] },
  { name: 'Zomato',           href: '/zomato-settings',    icon: BuildingStorefrontIcon,   roles: ['ADMIN'], featureKey: 'zomato' },
  { name: 'Subscription',     href: '/subscription',       icon: CreditCardIcon,           roles: ['ADMIN'] },
  { name: 'Features',         href: '/features',           icon: Cog6ToothIcon,            roles: ['ADMIN'] },
  // AI Analytics
  { name: 'AI Dashboard',     href: '/ai',                 icon: SparklesIcon,             roles: ['ADMIN'], section: 'AI Analytics' },
  { name: 'AI Copilot',       href: '/ai/copilot',         icon: ChatBubbleLeftRightIcon,  roles: ['ADMIN'] },
  { name: 'Forecasts',        href: '/ai/forecasts',       icon: PresentationChartLineIcon,roles: ['ADMIN'] },
  { name: 'Customer Insights',href: '/ai/customers',       icon: UserGroupIcon,            roles: ['ADMIN'] },
  { name: 'Recommendations',  href: '/ai/recommendations', icon: LightBulbIcon,            roles: ['ADMIN'] },
  { name: 'Inventory AI',     href: '/ai/inventory',       icon: ArchiveBoxIcon,           roles: ['ADMIN'] },
  { name: 'Wait Time AI',     href: '/ai/wait-time',       icon: ClockIcon,                roles: ['ADMIN'] },
  { name: 'AI Reports',       href: '/ai/reports',         icon: DocumentChartBarIcon,     roles: ['ADMIN'] },
  { name: 'Models',           href: '/ai/models',          icon: CpuChipIcon,              roles: ['ADMIN'] },
  { name: 'Events',           href: '/ai/events',          icon: BoltIcon,                 roles: ['ADMIN'] },
  { name: 'Workflows',        href: '/ai/workflows',       icon: ArrowPathIcon,            roles: ['ADMIN'] },
  { name: 'Autonomous AI',    href: '/ai/autonomy',        icon: ShieldCheckIcon,          roles: ['ADMIN'] },
  { name: 'Agents',           href: '/ai/agents',          icon: CircleStackIcon,          roles: ['ADMIN'] },
  { name: 'Knowledge Base',   href: '/ai/knowledge',       icon: BookmarkSquareIcon,       roles: ['ADMIN'] },
  { name: 'System Health',    href: '/ai/health',          icon: HeartIcon,                roles: ['ADMIN'] },
  { name: 'Platform (Owner)', href: '/owner',              icon: GlobeAltIcon,             superAdmin: true },
  { name: 'Multi Outlet',     href: '/multi-outlet',      icon: BuildingStorefrontIcon,    superAdmin: true },
]

interface LayoutProps {
  children: React.ReactNode
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout, switchRestaurant, currentRestaurantName, setCurrentRestaurantName } = useAuth()
  const { isConnected } = useSocket()
  const { features, restaurantType } = useFeatures()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [aiMenuOpen, setAiMenuOpen] = useState(() => location.pathname.startsWith('/ai'))

  // Restaurant switcher state
  const [switchOpen, setSwitchOpen] = useState(false)
  const [availableRestaurants, setAvailableRestaurants] = useState<AvailableRestaurant[]>([])
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Global "ready to serve" alert (toast + chime) on every screen
  useReadyNotifications()

  // Fetch accessible restaurants for super admins, and auto-restore
  // the restaurant name when it's missing (e.g. after fresh login).
  useEffect(() => {
    if (!user?.isSuperAdmin) return
    api.get('/organizations/my-restaurants')
      .then((res) => {
        const list: AvailableRestaurant[] = res.data.data
        setAvailableRestaurants(list)
        // Auto-restore restaurant name after login/logout cycle
        if (!currentRestaurantName && user?.restaurantId) {
          const match = list.find((r) => r.id === user.restaurantId)
          if (match) setCurrentRestaurantName(match.name)
        }
      })
      .catch(() => {})
  }, [user?.isSuperAdmin])

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setSwitchOpen(false)
      }
    }
    if (switchOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [switchOpen])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const filteredNav = navItems.filter((item) => {
    // Platform super-admin: only show the Platform (Owner) nav item
    if (user?.isSuperAdmin) {
      return item.superAdmin === true
    }
    // Normal restaurant users: role-based + feature-based + type-based filtering
    if (item.superAdmin) return false
    if (item.roles && !item.roles.includes(user?.role || '')) return false
    if (item.featureKey && !(features as any)[item.featureKey]) return false
    if (item.restaurantTypes && restaurantType && !item.restaurantTypes.includes(restaurantType)) return false
    return true
  })

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-navy-950 text-white">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 ring-1 ring-white/15 shadow-lg">
          <img src="/icon-512.png" alt="AuraOS" className="w-full h-full object-cover" />
        </div>
        <div>
          <p className="font-bold text-white text-base leading-none tracking-tight">AuraOS</p>
          <p className="text-[11px] text-navy-300 mt-1 font-medium">Restaurant Platform</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
        {filteredNav.map((item) => {
          const isActive =
            item.href === '/'
              ? location.pathname === '/'
              : item.href === '/ai'
                ? location.pathname === '/ai'
                : location.pathname.startsWith(item.href)
          const isAiSection = item.section === 'AI Analytics'
          const isAiChild = !item.section && item.href.startsWith('/ai/')

          if (isAiSection) {
            return (
              <div key={item.name}>
                <button
                  onClick={() => setAiMenuOpen(!aiMenuOpen)}
                  className="w-full flex items-center gap-3 px-3 py-2 mt-3 mb-1 text-[10px] font-bold uppercase tracking-widest text-navy-400 hover:text-navy-200 transition-colors"
                >
                  <SparklesIcon className="w-4 h-4" />
                  <span className="flex-1 text-left">AI Analytics</span>
                  <ChevronDownIcon className={cn('w-3.5 h-3.5 transition-transform duration-200', aiMenuOpen && 'rotate-180')} />
                </button>
                {aiMenuOpen && (
                  <Link
                    to={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn('nav-item relative ml-2', isActive && 'active')}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-accent-400" />
                    )}
                    <item.icon className={cn('w-5 h-5 shrink-0', isActive ? 'text-accent-400' : 'text-navy-300')} />
                    <span className="flex-1">Dashboard</span>
                  </Link>
                )}
              </div>
            )
          }

          if (isAiChild) {
            if (!aiMenuOpen) return null
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn('nav-item relative ml-2', isActive && 'active')}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-accent-400" />
                )}
                <item.icon className={cn('w-5 h-5 shrink-0', isActive ? 'text-accent-400' : 'text-navy-300')} />
                <span className="flex-1">{item.name}</span>
              </Link>
            )
          }

          return (
            <Link
              key={item.name}
              to={item.href}
              onClick={() => setSidebarOpen(false)}
              className={cn('nav-item relative', isActive && 'active')}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-accent-400" />
              )}
              <item.icon className={cn('w-5 h-5 shrink-0', isActive ? 'text-accent-400' : 'text-navy-300')} />
              <span className="flex-1">{item.name}</span>
              {item.badge ? (
                <span className="ml-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-white/10 space-y-2">
        {/* Restaurant switcher (super admin only) */}
        {user?.isSuperAdmin && availableRestaurants.length > 0 && (
          <div ref={dropdownRef} className="relative">
            <button
              onClick={() => setSwitchOpen(!switchOpen)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-left"
            >
              <BuildingStorefrontIcon className="w-4 h-4 text-navy-300 shrink-0" />
              <span className="flex-1 text-xs text-navy-200 truncate">
                {currentRestaurantName || 'Select restaurant'}
              </span>
              <ChevronUpDownIcon className="w-4 h-4 text-navy-400 shrink-0" />
            </button>

            {switchOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-navy-800 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 max-h-48 overflow-y-auto scrollbar-thin">
                {availableRestaurants.map((r) => {
                  const isCurrent = currentRestaurantName === r.name
                  return (
                    <button
                      key={r.id}
                      onClick={() => {
                        setSwitchOpen(false)
                        switchRestaurant(r.id, r.name)
                      }}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors',
                        isCurrent
                          ? 'bg-brand-500/20 text-white'
                          : 'text-navy-200 hover:bg-white/10 hover:text-white',
                      )}
                    >
                      <span className="flex-1 truncate">{r.name}</span>
                      <span className="text-[10px] text-navy-400 capitalize">{r.restaurant_type}</span>
                      {isCurrent && <CheckIcon className="w-3.5 h-3.5 text-accent-400 shrink-0" />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Connection status */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5">
          {isConnected ? (
            <>
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              <span className="text-xs text-emerald-300 font-medium">Live · Connected</span>
            </>
          ) : (
            <>
              <ExclamationCircleIcon className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-xs text-amber-300 font-medium">Reconnecting…</span>
            </>
          )}
        </div>

        {/* User */}
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center shrink-0 ring-1 ring-white/20">
            <span className="text-white font-semibold text-xs">
              {getInitials(user?.name || 'U')}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-[11px] text-navy-300 capitalize">{user?.role?.toLowerCase()}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Logout"
            className="p-1.5 rounded-lg text-navy-300 hover:text-white hover:bg-red-500/80 transition-colors"
          >
            <ArrowRightOnRectangleIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-64 fixed inset-y-0 left-0 z-30 shadow-xl">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div
            className="fixed inset-0 bg-navy-950/60 backdrop-blur-sm animate-fade-in"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative flex flex-col w-72 shadow-2xl z-50 animate-slide-up">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-navy-300 hover:bg-white/10 z-10"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen">
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-20 glass border-b border-slate-200 px-4 py-3 header-safe flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
          >
            <Bars3Icon className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg overflow-hidden ring-1 ring-slate-200">
              <img src="/icon-512.png" alt="AuraOS" className="w-full h-full object-cover" />
            </div>
            <span className="font-bold text-slate-900 text-sm tracking-tight">AuraOS</span>
          </div>
        </header>

        {/* Subscription status banner — full width under the header */}
        <SubscriptionBanner />

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-8 max-w-screen-2xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  )
}

export default Layout
