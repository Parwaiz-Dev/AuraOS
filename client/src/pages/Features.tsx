/**
 * Features — Settings → Features
 *
 * Admin can toggle which features are active for their restaurant.
 * Useful when selling AuraOS to restaurants that don't need every module
 * (e.g. a small café that doesn't use a kitchen display or Zomato).
 *
 * Changes are saved immediately on toggle (no Save button needed).
 */
import { useState } from 'react'
import toast from 'react-hot-toast'
import api, { getErrorMessage } from '../api'
import { useFeatures, RestaurantFeatures } from '../contexts/FeaturesContext'
import Card from '../components/Card'
import Loading from '../components/Loading'
import {
  ComputerDesktopIcon,
  CubeIcon,
  ChartBarIcon,
  QrCodeIcon,
  ChatBubbleLeftRightIcon,
  BuildingStorefrontIcon,
  CurrencyDollarIcon,
  DevicePhoneMobileIcon,
} from '@heroicons/react/24/outline'

interface FeatureDef {
  key: keyof RestaurantFeatures
  label: string
  description: string
  icon: React.ElementType
  iconColor: string
}

const FEATURE_DEFS: FeatureDef[] = [
  {
    key: 'kitchen_display',
    label: 'Kitchen Display',
    description: 'Real-time order screen for kitchen staff. Disable for restaurants without a dedicated kitchen screen.',
    icon: ComputerDesktopIcon,
    iconColor: 'text-amber-600 bg-amber-50',
  },
  {
    key: 'inventory',
    label: 'Inventory Management',
    description: 'Track stock levels, set reorder alerts, and log stock changes.',
    icon: CubeIcon,
    iconColor: 'text-blue-600 bg-blue-50',
  },
  {
    key: 'reports',
    label: 'Reports & Analytics',
    description: 'Revenue trends, top-selling items, and daily summaries.',
    icon: ChartBarIcon,
    iconColor: 'text-purple-600 bg-purple-50',
  },
  {
    key: 'qr_ordering',
    label: 'QR / Customer Ordering',
    description: 'Let customers scan a QR code to browse the menu and place orders.',
    icon: QrCodeIcon,
    iconColor: 'text-indigo-600 bg-indigo-50',
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp Integration',
    description: 'Receive orders via WhatsApp Business API.',
    icon: ChatBubbleLeftRightIcon,
    iconColor: 'text-emerald-600 bg-emerald-50',
  },
  {
    key: 'zomato',
    label: 'Zomato Integration',
    description: 'Receive and manage Zomato orders directly in AuraOS.',
    icon: BuildingStorefrontIcon,
    iconColor: 'text-red-600 bg-red-50',
  },
  {
    key: 'payments',
    label: 'Payments',
    description: 'Record and track payments. Disable for cash-only setups that track payments externally.',
    icon: CurrencyDollarIcon,
    iconColor: 'text-green-600 bg-green-50',
  },
  {
    key: 'waiter_app',
    label: 'Waiter App (PWA)',
    description: 'Mobile app for waiters to take orders table-side.',
    icon: DevicePhoneMobileIcon,
    iconColor: 'text-navy-600 bg-navy-50',
  },
]

const Features: React.FC = () => {
  const { features, loading, reload } = useFeatures()
  const [saving, setSaving] = useState<keyof RestaurantFeatures | null>(null)

  const toggle = async (key: keyof RestaurantFeatures) => {
    setSaving(key)
    try {
      await api.put('/restaurants/me', {
        features: { [key]: !features[key] },
      })
      await reload()
      toast.success(`${key.replace(/_/g, ' ')} ${!features[key] ? 'enabled' : 'disabled'}`)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(null)
    }
  }

  if (loading) return <Loading text="Loading features…" />

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Features</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Enable or disable modules for this restaurant. Changes take effect immediately.
        </p>
      </div>

      <Card padding="none">
        <div className="divide-y divide-slate-100">
          {FEATURE_DEFS.map((f) => {
            const enabled = features[f.key]
            const isSaving = saving === f.key
            return (
              <div key={f.key} className="flex items-center gap-4 px-6 py-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${f.iconColor}`}>
                  <f.icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{f.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{f.description}</p>
                </div>
                <button
                  onClick={() => toggle(f.key)}
                  disabled={isSaving}
                  className={`relative w-12 h-6 rounded-full transition-colors duration-200 shrink-0 disabled:opacity-60 ${
                    enabled ? 'bg-brand-600' : 'bg-slate-200'
                  }`}
                  title={enabled ? 'Click to disable' : 'Click to enable'}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                      enabled ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            )
          })}
        </div>
      </Card>

      <p className="text-xs text-slate-400">
        Disabled features are hidden from the navigation. Data is preserved — re-enabling a feature restores full access.
      </p>
    </div>
  )
}

export default Features
