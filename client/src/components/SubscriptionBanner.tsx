/**
 * SubscriptionBanner — app-wide status strip shown under the header.
 *
 *   TRIAL        → "Your trial ends in X days" (info, with Upgrade link)
 *   GRACE_PERIOD → "Payment overdue. X days remaining before suspension" (warning)
 *   SUSPENDED    → "Account suspended. Please contact support" (error)
 *   CANCELLED    → "Subscription cancelled. Reactivate to continue" (error)
 *   ACTIVE       → no banner
 *
 * Renders nothing while loading or when nothing needs the user's attention.
 */
import { Link } from 'react-router-dom'
import { useSubscription } from '../contexts/SubscriptionContext'
import {
  ClockIcon,
  ExclamationTriangleIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline'

const SubscriptionBanner: React.FC = () => {
  const { subscription } = useSubscription()
  if (!subscription) return null

  const { status, days_remaining, grace_days_remaining } = subscription

  if (status === 'ACTIVE') return null

  if (status === 'TRIAL') {
    const d = days_remaining ?? 0
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 border-b border-indigo-100 text-sm">
        <ClockIcon className="w-4 h-4 text-indigo-500 shrink-0" />
        <span className="text-indigo-800">
          Your free trial ends in <strong>{d} day{d !== 1 ? 's' : ''}</strong>.
        </span>
        <Link to="/subscription" className="ml-auto font-medium text-indigo-600 hover:text-indigo-800 whitespace-nowrap">
          Choose a plan →
        </Link>
      </div>
    )
  }

  if (status === 'GRACE_PERIOD') {
    const d = grace_days_remaining ?? 0
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border-b border-amber-200 text-sm">
        <ExclamationTriangleIcon className="w-4 h-4 text-amber-500 shrink-0" />
        <span className="text-amber-800">
          Payment overdue. <strong>{d} day{d !== 1 ? 's' : ''}</strong> remaining before your account is suspended.
        </span>
        <Link to="/subscription" className="ml-auto font-medium text-amber-700 hover:text-amber-900 whitespace-nowrap">
          Pay now →
        </Link>
      </div>
    )
  }

  // SUSPENDED / CANCELLED
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border-b border-red-200 text-sm">
      <LockClosedIcon className="w-4 h-4 text-red-500 shrink-0" />
      <span className="text-red-800">
        {status === 'SUSPENDED'
          ? 'Account suspended — your workspace is read-only. Please renew or contact support.'
          : 'Subscription cancelled — your workspace is read-only. Reactivate to continue.'}
      </span>
      <Link to="/subscription" className="ml-auto font-medium text-red-700 hover:text-red-900 whitespace-nowrap">
        View billing →
      </Link>
    </div>
  )
}

export default SubscriptionBanner
