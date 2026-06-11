/**
 * Restaurant Types Configuration
 *
 * Central config for type-aware UI adaptation:
 * - Type labels, descriptions, icons
 * - Nav visibility (which sidebar items show per type)
 * - Dashboard card registry (which stat cards to show per type)
 * - Setup wizard step definitions
 *
 * Phase 1 — Foundation only: structure and configuration.
 * No loyalty, reservations, or analytics.
 */

import {
  CurrencyDollarIcon,
  ClipboardDocumentListIcon,
  TableCellsIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import { FireIcon } from '@heroicons/react/24/outline'

// ---------------------------------------------------------------------------
// Restaurant Type
// ---------------------------------------------------------------------------

export type RestaurantType =
  | 'FULL_SERVICE'
  | 'QSR_SIMPLE'
  | 'QSR_CHAIN'
  | 'CAFE'
  | 'CLOUD_KITCHEN'
  | 'HYBRID'

export const RESTAURANT_TYPES: RestaurantType[] = [
  'FULL_SERVICE',
  'QSR_SIMPLE',
  'QSR_CHAIN',
  'CAFE',
  'CLOUD_KITCHEN',
  'HYBRID',
]

export interface RestaurantTypeInfo {
  label: string
  description: string
  icon: string // emoji
}

export const RESTAURANT_TYPE_CONFIG: Record<RestaurantType, RestaurantTypeInfo> = {
  FULL_SERVICE: {
    label: 'Full Service Restaurant',
    description: 'Table service, reservations, dine-in focused',
    icon: '🍽️',
  },
  QSR_SIMPLE: {
    label: 'Simple QSR',
    description: 'Counter service, token-based ordering, quick turnover',
    icon: '🍔',
  },
  QSR_CHAIN: {
    label: 'QSR Chain',
    description: 'Multi-outlet, standardized operations',
    icon: '🏪',
  },
  CAFE: {
    label: 'Café',
    description: 'Beverage-focused, light food, casual atmosphere',
    icon: '☕',
  },
  CLOUD_KITCHEN: {
    label: 'Cloud Kitchen',
    description: 'Delivery-only, no dine-in, aggregator-focused',
    icon: '📦',
  },
  HYBRID: {
    label: 'Hybrid',
    description: 'Mix of dine-in, delivery, and takeaway',
    icon: '🔄',
  },
}

// ---------------------------------------------------------------------------
// Default Features by Restaurant Type
// ---------------------------------------------------------------------------

export interface FeatureFlags {
  kitchen_display: boolean
  inventory: boolean
  reports: boolean
  qr_ordering: boolean
  whatsapp: boolean
  zomato: boolean
  payments: boolean
  waiter_app: boolean
}

/**
 * Default features auto-applied when a restaurant type is selected during
 * superadmin creation. The superadmin can still manually toggle individual
 * features afterward.
 */
export const DEFAULT_FEATURES_BY_TYPE: Record<RestaurantType, FeatureFlags> = {
  FULL_SERVICE: {
    kitchen_display: true,
    inventory: true,
    reports: true,
    qr_ordering: true,
    whatsapp: true,
    zomato: true,
    payments: true,
    waiter_app: true,
  },
  QSR_SIMPLE: {
    kitchen_display: true,
    inventory: true,
    reports: true,
    qr_ordering: false,
    whatsapp: true,
    zomato: true,
    payments: true,
    waiter_app: false,
  },
  QSR_CHAIN: {
    kitchen_display: true,
    inventory: true,
    reports: true,
    qr_ordering: false,
    whatsapp: true,
    zomato: true,
    payments: true,
    waiter_app: false,
  },
  CAFE: {
    kitchen_display: true,
    inventory: true,
    reports: true,
    qr_ordering: true,
    whatsapp: true,
    zomato: true,
    payments: true,
    waiter_app: false,
  },
  CLOUD_KITCHEN: {
    kitchen_display: true,
    inventory: true,
    reports: true,
    qr_ordering: false,
    whatsapp: true,
    zomato: true,
    payments: true,
    waiter_app: false,
  },
  HYBRID: {
    kitchen_display: true,
    inventory: true,
    reports: true,
    qr_ordering: true,
    whatsapp: true,
    zomato: true,
    payments: true,
    waiter_app: true,
  },
}

// ---------------------------------------------------------------------------
// Nav Visibility
// ---------------------------------------------------------------------------

/**
 * Which restaurant types see each nav item.
 * Keyed by nav item name (exact match with Layout navItems).
 * `undefined` means visible for ALL restaurant types.
 */
export const NAV_TYPE_VISIBILITY: Record<string, RestaurantType[] | undefined> = {
  Tables: ['FULL_SERVICE', 'CAFE', 'HYBRID'],
  'QR Settings': ['FULL_SERVICE', 'QSR_SIMPLE', 'QSR_CHAIN', 'CAFE', 'HYBRID'],
}

// ---------------------------------------------------------------------------
// Dashboard Card Registry
// ---------------------------------------------------------------------------

export type DashboardCardKey =
  | 'revenue_today'
  | 'total_orders_today'
  | 'active_orders'
  | 'occupied_tables'
  | 'completed_orders_today'
  | 'cancelled_orders_today'
  | 'low_stock_items'

export interface DashboardCardConfig {
  label: string
  icon: React.ElementType
  color: string
  sub?: string
}

export const DASHBOARD_CARD_CONFIG: Record<DashboardCardKey, DashboardCardConfig> = {
  revenue_today: {
    label: "Today's Revenue",
    icon: CurrencyDollarIcon,
    color: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
  },
  total_orders_today: {
    label: 'Total Orders',
    icon: ClipboardDocumentListIcon,
    color: 'bg-gradient-to-br from-brand-500 to-brand-700',
  },
  active_orders: {
    label: 'Active Orders',
    icon: FireIcon,
    color: 'bg-gradient-to-br from-accent-400 to-accent-600',
    sub: 'In kitchen right now',
  },
  occupied_tables: {
    label: 'Occupied Tables',
    icon: TableCellsIcon,
    color: 'bg-gradient-to-br from-navy-500 to-navy-700',
    sub: 'Currently serving',
  },
  completed_orders_today: {
    label: 'Ready Orders',
    icon: CheckCircleIcon,
    color: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
    sub: 'Completed today',
  },
  cancelled_orders_today: {
    label: 'Cancelled',
    icon: ExclamationTriangleIcon,
    color: 'bg-gradient-to-br from-red-400 to-red-500',
  },
  low_stock_items: {
    label: 'Low Stock',
    icon: ExclamationTriangleIcon,
    color: 'bg-gradient-to-br from-amber-400 to-amber-500',
  },
}

/**
 * Cards shown in the 4-card stat grid for each restaurant type.
 * Order matters — cards render in the order listed.
 */
export const DASHBOARD_CARDS_BY_TYPE: Record<RestaurantType, DashboardCardKey[]> = {
  FULL_SERVICE: ['occupied_tables', 'active_orders', 'revenue_today', 'total_orders_today'],
  QSR_SIMPLE: ['active_orders', 'completed_orders_today', 'revenue_today', 'total_orders_today'],
  QSR_CHAIN: ['active_orders', 'completed_orders_today', 'revenue_today', 'total_orders_today'],
  CAFE: ['total_orders_today', 'completed_orders_today', 'revenue_today', 'active_orders'],
  CLOUD_KITCHEN: ['total_orders_today', 'active_orders', 'revenue_today', 'completed_orders_today'],
  HYBRID: ['occupied_tables', 'active_orders', 'revenue_today', 'total_orders_today'],
}

// ---------------------------------------------------------------------------
// Setup Wizard Step Definitions (Phase 2)
// ---------------------------------------------------------------------------

export type StepStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped'

export interface SetupProgress {
  steps: Record<string, StepStatus>
  lastUpdated: string
  dismissed: boolean
}

export interface WizardStep {
  id: string
  label: string
  description: string
  /** When true, the feature page doesn't exist yet — show placeholder content */
  placeholder?: boolean
}

export const SETUP_WIZARD_STEPS: Record<RestaurantType, WizardStep[]> = {
  FULL_SERVICE: [
    { id: 'tables', label: 'Create Tables', description: 'Configure your dining tables and sections' },
    { id: 'menu', label: 'Add Menu', description: 'Create categories and add menu items' },
    { id: 'gst', label: 'GST Settings', description: 'Configure tax rates and GSTIN' },
    { id: 'payments', label: 'Payment Setup', description: 'Set up payment methods and UPI' },
    { id: 'qr', label: 'Generate QR', description: 'Create QR codes for table ordering' },
  ],
  QSR_SIMPLE: [
    { id: 'token_prefix', label: 'Token Prefix', description: 'Set order token prefix for identification' },
    { id: 'qsr_settings', label: 'QSR Settings', description: 'Configure quick-service restaurant settings' },
    { id: 'menu', label: 'Add Menu', description: 'Create categories and add menu items' },
    { id: 'payments', label: 'Payment Setup', description: 'Set up payment methods and UPI' },
    { id: 'display_screen', label: 'Customer Display Screen', description: 'Set up order status display for customers' },
  ],
  QSR_CHAIN: [
    { id: 'token_prefix', label: 'Token Prefix', description: 'Set order token prefix for identification' },
    { id: 'qsr_settings', label: 'QSR Settings', description: 'Configure quick-service restaurant settings' },
    { id: 'menu', label: 'Add Menu', description: 'Create categories and add menu items' },
    { id: 'payments', label: 'Payment Setup', description: 'Set up payment methods and UPI' },
    { id: 'display_screen', label: 'Customer Display Screen', description: 'Set up order status display for customers' },
  ],
  CAFE: [
    { id: 'menu', label: 'Add Menu', description: 'Create beverage and food categories' },
    { id: 'modifier_groups', label: 'Modifier Groups', description: 'Set up customizations like milk type, toppings', placeholder: true },
    { id: 'payments', label: 'Payment Setup', description: 'Set up payment methods and UPI' },
    { id: 'qr_ordering', label: 'QR Ordering', description: 'Enable QR-based ordering for tables' },
  ],
  CLOUD_KITCHEN: [
    { id: 'menu', label: 'Add Menu', description: 'Create delivery-optimized menu items' },
    { id: 'packaging_charges', label: 'Packaging Charges', description: 'Configure packaging fees per item', placeholder: true },
    { id: 'delivery_settings', label: 'Delivery Settings', description: 'Set up delivery zones and charges', placeholder: true },
    { id: 'zomato', label: 'Zomato Setup', description: 'Configure Zomato aggregator integration' },
  ],
  HYBRID: [
    { id: 'tables', label: 'Tables', description: 'Configure dine-in tables and sections' },
    { id: 'token_settings', label: 'Token Settings', description: 'Configure token system for takeaway orders' },
    { id: 'menu', label: 'Menu', description: 'Create menu for both dine-in and delivery' },
    { id: 'payments', label: 'Payments', description: 'Set up payment methods' },
    { id: 'qr', label: 'QR', description: 'Generate QR codes for dining areas' },
  ],
}

// ---------------------------------------------------------------------------
// Setup Progress Helpers (localStorage-backed)
// ---------------------------------------------------------------------------

const SETUP_PROGRESS_PREFIX = 'auraos_setup_'

export function loadSetupProgress(restaurantId: string): SetupProgress {
  try {
    const raw = localStorage.getItem(`${SETUP_PROGRESS_PREFIX}${restaurantId}`)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && parsed.steps && typeof parsed.lastUpdated === 'string') {
        return {
          steps: parsed.steps,
          lastUpdated: parsed.lastUpdated,
          dismissed: !!parsed.dismissed,
        }
      }
    }
  } catch { /* corrupted — fall through to default */ }
  return { steps: {}, lastUpdated: new Date().toISOString(), dismissed: false }
}

export function saveSetupProgress(restaurantId: string, progress: SetupProgress): void {
  localStorage.setItem(
    `${SETUP_PROGRESS_PREFIX}${restaurantId}`,
    JSON.stringify({ ...progress, lastUpdated: new Date().toISOString() }),
  )
}

/** Compute completion % — skipped and completed both count as "done" */
export function computeSetupProgress(progress: SetupProgress, totalSteps: number): number {
  if (totalSteps === 0) return 100
  const done = Object.values(progress.steps).filter(
    (s) => s === 'completed' || s === 'skipped',
  ).length
  return Math.round((done / totalSteps) * 100)
}