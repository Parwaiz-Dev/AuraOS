/**
 * Subscription — Settings → Subscription & Billing.
 *
 * Shows current plan, status, trial/grace countdown, next renewal, the plan
 * catalogue (with a one-click change), and the restaurant's invoices with a
 * "Mark as paid" action (Phase 1 = manual UPI / bank transfer / cash).
 */
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { subscriptionApi, getErrorMessage } from '../api'
import { useSubscription } from '../contexts/SubscriptionContext'
import { SubscriptionPlan, Invoice } from '../types/subscription'
import Card from '../components/Card'
import Badge from '../components/Badge'
import Button from '../components/Button'
import Loading from '../components/Loading'
import { formatCurrency, formatDate } from '../lib/utils'
import {
  CheckCircleIcon,
  ClockIcon,
  CreditCardIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline'

const STATUS_BADGE: Record<string, { variant: any; label: string }> = {
  TRIAL:        { variant: 'info',    label: 'Trial' },
  ACTIVE:       { variant: 'success', label: 'Active' },
  GRACE_PERIOD: { variant: 'warning', label: 'Grace Period' },
  SUSPENDED:    { variant: 'error',   label: 'Suspended' },
  CANCELLED:    { variant: 'error',   label: 'Cancelled' },
}

const INVOICE_BADGE: Record<string, any> = {
  DRAFT: 'default', PENDING: 'warning', PAID: 'success', OVERDUE: 'error', CANCELLED: 'default',
}

const Subscription: React.FC = () => {
  const { subscription, loading: subLoading, refresh } = useSubscription()
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [changingPlan, setChangingPlan] = useState<string | null>(null)
  const [payingId, setPayingId] = useState<string | null>(null)

  const load = async () => {
    try {
      const [planRes, invRes] = await Promise.all([
        subscriptionApi.getPlans(),
        subscriptionApi.getInvoices(),
      ])
      setPlans(planRes.data.data || [])
      setInvoices(invRes.data.data || [])
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleChangePlan = async (planId: string) => {
    if (!confirm('Switch to this plan? An invoice will be generated for payment.')) return
    setChangingPlan(planId)
    try {
      await subscriptionApi.changePlan(planId)
      toast.success('Plan updated')
      await refresh()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setChangingPlan(null)
    }
  }

  const handleMarkPaid = async (id: string) => {
    setPayingId(id)
    try {
      await subscriptionApi.markInvoicePaid(id)
      toast.success('Invoice marked as paid')
      await Promise.all([load(), refresh()])
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setPayingId(null)
    }
  }

  if (subLoading || loading) return <Loading text="Loading subscription…" />

  const statusBadge = subscription ? STATUS_BADGE[subscription.status] : null

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Subscription & Billing</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage your plan and invoices</p>
      </div>

      {/* Current status card */}
      {subscription && (
        <Card>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-gray-900">
                  {subscription.plan?.name || 'No plan selected'}
                </h2>
                {statusBadge && <Badge variant={statusBadge.variant} dot>{statusBadge.label}</Badge>}
              </div>
              {subscription.plan && subscription.plan.price > 0 && (
                <p className="text-sm text-gray-500">
                  {formatCurrency(subscription.plan.price)} / {subscription.plan.billing_cycle.toLowerCase()}
                </p>
              )}
            </div>

            {/* Countdown / renewal */}
            <div className="sm:text-right">
              {subscription.status === 'TRIAL' && (
                <div className="flex items-center gap-2 text-indigo-600">
                  <ClockIcon className="w-5 h-5" />
                  <span className="font-semibold">{subscription.days_remaining ?? 0} days left in trial</span>
                </div>
              )}
              {subscription.status === 'GRACE_PERIOD' && (
                <div className="text-amber-600 font-semibold">
                  {subscription.grace_days_remaining ?? 0} days before suspension
                </div>
              )}
              {subscription.next_renewal_date && (
                <p className="text-xs text-gray-400 mt-1">
                  {subscription.status === 'ACTIVE' ? 'Renews' : 'Ends'} {formatDate(subscription.next_renewal_date)}
                </p>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Plans */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <CreditCardIcon className="w-4 h-4" /> Available Plans
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const isCurrent = subscription?.plan_id === plan.id
            const isCustom = plan.billing_cycle === 'CUSTOM' || plan.price === 0
            return (
              <Card key={plan.id} className={isCurrent ? 'ring-2 ring-indigo-500' : ''}>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-gray-900">{plan.name}</h4>
                    {isCurrent && <Badge variant="success">Current</Badge>}
                  </div>
                  <div>
                    {isCustom ? (
                      <p className="text-2xl font-bold text-gray-900">Custom</p>
                    ) : (
                      <p className="text-2xl font-bold text-gray-900">
                        {formatCurrency(plan.price)}
                        <span className="text-sm font-normal text-gray-400">/{plan.billing_cycle.toLowerCase()}</span>
                      </p>
                    )}
                  </div>
                  {plan.description && <p className="text-xs text-gray-500 leading-relaxed">{plan.description}</p>}
                  <Button
                    variant={isCurrent ? 'outline' : 'primary'}
                    fullWidth
                    size="sm"
                    disabled={isCurrent || isCustom}
                    isLoading={changingPlan === plan.id}
                    onClick={() => handleChangePlan(plan.id)}
                  >
                    {isCurrent ? 'Current Plan' : isCustom ? 'Contact Sales' : 'Choose Plan'}
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Invoices */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <DocumentTextIcon className="w-4 h-4" /> Invoices
        </h3>
        <Card padding="none">
          {invoices.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No invoices yet</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {invoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between gap-4 px-5 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 text-sm">{inv.invoice_number}</span>
                      <Badge variant={INVOICE_BADGE[inv.status]}>{inv.status}</Badge>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {inv.due_date ? `Due ${formatDate(inv.due_date)}` : `Created ${formatDate(inv.created_at)}`}
                      {inv.paid_at && ` · Paid ${formatDate(inv.paid_at)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-semibold text-gray-900">{formatCurrency(inv.amount)}</span>
                    {(inv.status === 'PENDING' || inv.status === 'OVERDUE') && (
                      <Button
                        variant="secondary"
                        size="sm"
                        leftIcon={<CheckCircleIcon className="w-4 h-4" />}
                        isLoading={payingId === inv.id}
                        onClick={() => handleMarkPaid(inv.id)}
                      >
                        Mark Paid
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
        <p className="text-xs text-gray-400 mt-2">
          Payments are accepted via UPI, bank transfer, or cash. Mark an invoice as paid once payment is received.
        </p>
      </div>
    </div>
  )
}

export default Subscription
