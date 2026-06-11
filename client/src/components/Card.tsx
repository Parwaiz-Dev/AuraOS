import React from 'react'
import { cn } from '../lib/utils'

interface CardProps {
  children: React.ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
  hover?: boolean
  onClick?: () => void
}

const paddingMap = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
}

const Card: React.FC<CardProps> = ({
  children,
  className,
  padding = 'md',
  hover = false,
  onClick,
}) => (
  <div
    onClick={onClick}
    className={cn(
      'bg-white rounded-2xl border border-slate-200/70 shadow-card',
      paddingMap[padding],
      hover && 'hover:shadow-card-hover hover:border-slate-300 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer',
      onClick && 'cursor-pointer',
      className
    )}
  >
    {children}
  </div>
)

export default Card
