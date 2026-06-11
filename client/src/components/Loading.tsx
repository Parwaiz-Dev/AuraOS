import React from 'react'
import { cn } from '../lib/utils'

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
  fullPage?: boolean
  className?: string
}

const sizeMap = {
  sm: 'h-5 w-5 border-2',
  md: 'h-8 w-8 border-2',
  lg: 'h-12 w-12 border-[3px]',
}

const Loading: React.FC<LoadingProps> = ({
  size = 'md',
  text,
  fullPage = false,
  className,
}) => {
  const spinner = (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <div
        className={cn(
          'rounded-full border-gray-200 border-t-indigo-600 animate-spin',
          sizeMap[size]
        )}
      />
      {text && <p className="text-sm text-gray-500">{text}</p>}
    </div>
  )

  if (fullPage) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-50">
        {spinner}
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center py-16">
      {spinner}
    </div>
  )
}

export default Loading
