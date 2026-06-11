import { useNavigate } from 'react-router-dom'
import Button from '../components/Button'
import { HomeIcon } from '@heroicons/react/24/outline'

const NotFound: React.FC = () => {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <p className="text-8xl font-bold text-indigo-100 mb-4">404</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Page not found</h1>
        <p className="text-gray-500 text-sm mb-8">
          The page you're looking for doesn't exist or you don't have access to it.
        </p>
        <Button
          variant="primary"
          leftIcon={<HomeIcon className="w-4 h-4" />}
          onClick={() => navigate('/dashboard')}
        >
          Back to Dashboard
        </Button>
      </div>
    </div>
  )
}

export default NotFound
