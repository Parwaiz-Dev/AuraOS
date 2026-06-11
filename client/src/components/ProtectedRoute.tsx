import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
  roles?: string[]  // if provided, only these roles can access
  superAdminOnly?: boolean  // if true, only super admins can access
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, roles, superAdminOnly }) => {
  const { isAuthenticated, isLoading, user } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-gray-200 border-t-indigo-600 animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // Super-admin guard — redirect to dashboard if user is not a super admin
  if (superAdminOnly && user && !user.isSuperAdmin) {
    return <Navigate to="/" replace />
  }

  // Role guard — redirect to dashboard if user doesn't have required role
  if (roles && roles.length > 0 && user && !roles.includes(user.role)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

export default ProtectedRoute