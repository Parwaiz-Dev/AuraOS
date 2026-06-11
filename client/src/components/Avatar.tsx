import React from 'react'

interface AvatarProps {
  src?: string
  alt?: string
  initials?: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger'
}

const Avatar: React.FC<AvatarProps> = ({ src, alt, initials, size = 'md', variant = 'default' }) => {
  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base'
  }

  const variantClasses = {
    default: 'bg-gray-300 text-gray-700',
    primary: 'bg-blue-300 text-blue-700',
    success: 'bg-green-300 text-green-700',
    warning: 'bg-yellow-300 text-yellow-700',
    danger: 'bg-red-300 text-red-700'
  }

  return (
    <div className={`${sizeClasses[size]} ${variantClasses[variant]} rounded-full flex items-center justify-center font-semibold overflow-hidden`}>
      {src ? (
        <img src={src} alt={alt} className="w-full h-full object-cover" />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  )
}

export default Avatar
