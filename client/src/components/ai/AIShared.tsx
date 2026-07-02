import React from 'react'
import { cn } from '../../lib/utils'

interface AIStatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ElementType
  trend?: number
  color?: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'indigo'
  loading?: boolean
}

const bgColorMap = {
  blue: 'bg-blue-50',
  green: 'bg-emerald-50',
  amber: 'bg-amber-50',
  red: 'bg-red-50',
  purple: 'bg-purple-50',
  indigo: 'bg-indigo-50',
}

const iconColorMap = {
  blue: 'text-blue-600',
  green: 'text-emerald-600',
  amber: 'text-amber-600',
  red: 'text-red-600',
  purple: 'text-purple-600',
  indigo: 'text-indigo-600',
}

export const AIStatCard: React.FC<AIStatCardProps> = ({
  title, value, subtitle, icon: Icon, trend, color = 'blue', loading,
}) => {
  if (loading) return <AIStatCardSkeleton />
  return (
    <div className="card hover:shadow-card-hover transition-shadow duration-200">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p>
          <p className="mt-1.5 text-2xl font-bold text-slate-900 truncate">{value}</p>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          {trend !== undefined && (
            <div className={cn('mt-1.5 inline-flex items-center gap-1 text-xs font-semibold', trend >= 0 ? 'text-emerald-600' : 'text-red-600')}>
              <span>{trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%</span>
            </div>
          )}
        </div>
        <div className={cn('p-2.5 rounded-xl', bgColorMap[color])}>
          <Icon className={cn('w-5 h-5', iconColorMap[color])} />
        </div>
      </div>
    </div>
  )
}

const AIStatCardSkeleton: React.FC = () => (
  <div className="card animate-pulse">
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <div className="h-3 w-20 bg-slate-200 rounded" />
        <div className="mt-2 h-7 w-28 bg-slate-200 rounded" />
        <div className="mt-1.5 h-3 w-16 bg-slate-200 rounded" />
      </div>
      <div className="w-10 h-10 bg-slate-200 rounded-xl" />
    </div>
  </div>
)

export const AIPageHeader: React.FC<{
  title: string
  subtitle?: string
  actions?: React.ReactNode
}> = ({ title, subtitle, actions }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
    <div>
      <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
    </div>
    {actions && <div className="flex items-center gap-2">{actions}</div>}
  </div>
)

export const AIEmptyState: React.FC<{
  icon: React.ElementType
  title: string
  description: string
}> = ({ icon: Icon, title, description }) => (
  <div className="flex flex-col items-center justify-center py-16 px-4">
    <div className="p-4 rounded-2xl bg-slate-100 mb-4">
      <Icon className="w-8 h-8 text-slate-400" />
    </div>
    <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
    <p className="mt-1 text-sm text-slate-500 text-center max-w-sm">{description}</p>
  </div>
)

export const AIErrorState: React.FC<{
  message: string
  onRetry?: () => void
}> = ({ message, onRetry }) => (
  <div className="flex flex-col items-center justify-center py-16 px-4">
    <div className="p-4 rounded-2xl bg-red-50 mb-4">
      <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    </div>
    <h3 className="text-lg font-semibold text-slate-900">Something went wrong</h3>
    <p className="mt-1 text-sm text-slate-500 text-center max-w-sm">{message}</p>
    {onRetry && (
      <button onClick={onRetry} className="mt-4 px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-xl hover:bg-brand-700 transition-colors">
        Try Again
      </button>
    )}
  </div>
)

export const AILoadingGrid: React.FC<{ count?: number }> = ({ count = 8 }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <AIStatCardSkeleton key={i} />
    ))}
  </div>
)

export const AIChartCard: React.FC<{
  title: string
  subtitle?: string
  children: React.ReactNode
  actions?: React.ReactNode
}> = ({ title, subtitle, children, actions }) => (
  <div className="card">
    <div className="flex items-start justify-between mb-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions}
    </div>
    {children}
  </div>
)

export const AIBadge: React.FC<{
  label: string
  variant?: 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'gray'
}> = ({ label, variant = 'gray' }) => (
  <span className={cn('badge', `badge-${variant}`)}>{label}</span>
)

export const AITabButton: React.FC<{
  active: boolean
  onClick: () => void
  children: React.ReactNode
}> = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={cn(
      'px-4 py-2 text-sm font-medium rounded-xl transition-colors',
      active
        ? 'bg-brand-600 text-white shadow-sm'
        : 'text-slate-600 hover:bg-slate-100',
    )}
  >
    {children}
  </button>
)
