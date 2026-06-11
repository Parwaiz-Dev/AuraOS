export type SubscriptionStatus =
  | 'TRIAL'
  | 'ACTIVE'
  | 'GRACE_PERIOD'
  | 'SUSPENDED'
  | 'CANCELLED'

export type BillingCycle = 'MONTHLY' | 'YEARLY' | 'CUSTOM'

export type InvoiceStatus = 'DRAFT' | 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED'

export interface SubscriptionPlan {
  id: string
  name: string
  price: number
  billing_cycle: BillingCycle
  description: string | null
  is_active: boolean
  gateway_plan_id: string | null
  created_at: string
  updated_at: string
}

export interface SubscriptionView {
  id: string
  restaurant_id: string
  plan_id: string | null
  status: SubscriptionStatus
  trial_started_at: string | null
  trial_ends_at: string | null
  started_at: string | null
  expires_at: string | null
  grace_period_ends_at: string | null
  gateway_subscription_id: string | null
  created_at: string
  updated_at: string
  plan: SubscriptionPlan | null
  days_remaining: number | null
  grace_days_remaining: number | null
  next_renewal_date: string | null
}

export interface Invoice {
  id: string
  restaurant_id: string
  subscription_id: string | null
  invoice_number: string
  amount: number
  due_date: string | null
  paid_at: string | null
  status: InvoiceStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export interface PlatformMetrics {
  total_restaurants: number
  active_subscriptions: number
  trial_accounts: number
  grace_period_accounts: number
  suspended_accounts: number
  cancelled_accounts: number
  mrr: number
  outstanding_invoices: number
  outstanding_amount: number
}
