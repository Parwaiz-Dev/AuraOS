import React from 'react'
import { cn } from '../lib/utils'

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'default' | 'purple' | 'orange'

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
  dot?: boolean
}

const variantMap: Record<BadgeVariant, string> = {
  success: 'badge-green',
  warning: 'badge-yellow',
  error:   'badge-red',
  info:    'badge-blue',
  default: 'badge-gray',
  purple:  'badge-purple',
  orange:  'badge-orange',
}

const dotColorMap: Record<BadgeVariant, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  error:   'bg-red-500',
  info:    'bg-blue-500',
  default: 'bg-gray-400',
  purple:  'bg-purple-500',
  orange:  'bg-orange-500',
}

const Badge: React.FC<BadgeProps> = ({ variant = 'default', children, className, dot }) => (
  <span className={cn('badge', variantMap[variant], className)}>
    {dot && (
      <span className={cn('w-1.5 h-1.5 rounded-full mr-1.5 shrink-0', dotColorMap[variant])} />
    )}
    {children}
  </span>
)

export default Badge
