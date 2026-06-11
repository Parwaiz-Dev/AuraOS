import { useOfflineSync } from '../hooks/useOfflineSync'

const OfflineBanner: React.FC = () => {
  const { isOnline, queueLength } = useOfflineSync()

  if (isOnline && queueLength === 0) return null

  return (
    <div className={`fixed top-0 inset-x-0 z-50 text-center text-xs font-semibold py-1.5 ${
      isOnline ? 'bg-amber-500 text-white' : 'bg-red-600 text-white'
    }`}>
      {isOnline
        ? `Syncing ${queueLength} queued order${queueLength > 1 ? 's' : ''}…`
        : `Offline — orders will be queued`}
    </div>
  )
}

export default OfflineBanner
