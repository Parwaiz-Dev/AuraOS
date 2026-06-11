import { z } from 'zod';

// ── Enums ──────────────────────────────────────────────────────────────────

export type SubscriptionStatus =
  | 'TRIAL'
  | 'ACTIVE'
  | 'GRACE_PERIOD'
  | 'SUSPENDED'
  | 'CANCELLED';

export type BillingCycle = 'MONTHLY' | 'YEARLY' | 'CUSTOM';

export type InvoiceStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'PAID'
  | 'OVERDUE'
  | 'CANCELLED';

// Statuses that grant write access (full app usage)
export const WRITE_ALLOWED_STATUSES: SubscriptionStatus[] = [
  'TRIAL',
  'ACTIVE',
  'GRACE_PERIOD',
];

// ── Entities ───────────────────────────────────────────────────────────────

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  billing_cycle: BillingCycle;
  description: string | null;
  is_active: boolean;
  gateway_plan_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Subscription {
  id: string;
  restaurant_id: string;
  plan_id: string | null;
  status: SubscriptionStatus;
  trial_started_at: Date | null;
  trial_ends_at: Date | null;
  started_at: Date | null;
  expires_at: Date | null;
  grace_period_ends_at: Date | null;
  gateway_subscription_id: string | null;
  created_at: Date;
  updated_at: Date;
}

// Subscription enriched with its plan + computed countdowns (for the UI)
export interface SubscriptionView extends Subscription {
  plan: SubscriptionPlan | null;
  days_remaining: number | null;      // days left in trial / until expiry
  grace_days_remaining: number | null; // days left in grace before suspension
  next_renewal_date: Date | null;
}

export interface Invoice {
  id: string;
  restaurant_id: string;
  subscription_id: string | null;
  invoice_number: string;
  amount: number;
  due_date: Date | null;
  paid_at: Date | null;
  status: InvoiceStatus;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

// ── Request schemas ──────────────────────────────────────────────────────────

export const CreateInvoiceSchema = z.object({
  amount: z.number().positive('Amount must be greater than 0'),
  due_date: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
  // Optional — defaults to the restaurant's current subscription
  subscription_id: z.string().uuid().optional(),
  status: z.enum(['DRAFT', 'PENDING']).optional().default('PENDING'),
});
export type CreateInvoiceRequest = z.infer<typeof CreateInvoiceSchema>;

export const ChangePlanSchema = z.object({
  plan_id: z.string().uuid('plan_id must be a valid UUID'),
});
export type ChangePlanRequest = z.infer<typeof ChangePlanSchema>;

// ── Super-admin platform metrics ───────────────────────────────────────────

export interface PlatformMetrics {
  total_restaurants: number;
  active_subscriptions: number;
  trial_accounts: number;
  grace_period_accounts: number;
  suspended_accounts: number;
  cancelled_accounts: number;
  mrr: number;                 // monthly recurring revenue
  outstanding_invoices: number; // count of PENDING + OVERDUE
  outstanding_amount: number;   // sum of PENDING + OVERDUE amounts
}
