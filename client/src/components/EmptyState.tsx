import React from 'react'
import { InboxIcon } from '@heroicons/react/24/outline'
import Button from './Button'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4 text-gray-400">
      {icon || <InboxIcon className="w-7 h-7" />}
    </div>
    <h3 className="text-base font-semibold text-gray-900 mb-1">{title}</h3>
    {description && <p className="text-sm text-gray-500 max-w-xs mb-5">{description}</p>}
    {action && (
      <Button variant="primary" size="sm" onClick={action.onClick}>
        {action.label}
      </Button>
    )}
  </div>
)

export default EmptyState
