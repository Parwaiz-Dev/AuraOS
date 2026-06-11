import React from 'react'

interface ToastProps {
  variant?: 'success' | 'error' | 'warning' | 'info'
  message: string
  onClose: () => void
}

const Toast: React.FC<ToastProps> = ({ variant = 'info', message, onClose }) => {
  const variantClasses = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  }

  React.useEffect(() => {
    const timer = setTimeout(onClose, 3000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div className={`border rounded-lg p-4 mb-4 flex items-center justify-between ${variantClasses[variant]}`}>
      <span>{message}</span>
      <button
        onClick={onClose}
        className="ml-4 text-sm font-semibold hover:opacity-70 transition-opacity"
      >
        ✕
      </button>
    </div>
  )
}

export default Toast
