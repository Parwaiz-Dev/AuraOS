import { useState, useMemo } from 'react'
import {
  LightBulbIcon,
  CheckCircleIcon,
  TagIcon,
  ChartBarIcon,
  CheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { aiRecommendationApi } from '../../services/aiApi'
import { useAIQuery } from '../../hooks/useAIQuery'
import {
  AIPageHeader,
  AIStatCard,
  AIErrorState,
  AIEmptyState,
  AILoadingGrid,
} from '../../components/ai/AIShared'

interface Recommendation {
  menu_item_id: string
  name: string
  category: string
  price: number
  reason: string
  score: number
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)

export default function AIRecommendations() {
  const { data, loading, error, refetch } = useAIQuery<Recommendation[]>(
    () => aiRecommendationApi.items(),
    [],
  )

  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())

  const visibleItems = useMemo(() => {
    if (!data) return []
    return data.filter((item) => !dismissedIds.has(item.menu_item_id))
  }, [data, dismissedIds])

  const stats = useMemo(() => {
    if (!visibleItems.length) {
      return { total: 0, highConfidence: 0, categories: 0, avgScore: 0 }
    }
    const categories = new Set(visibleItems.map((r) => r.category))
    const highConfidence = visibleItems.filter((r) => r.score > 0.8).length
    const avgScore =
      visibleItems.reduce((sum, r) => sum + r.score, 0) / visibleItems.length
    return {
      total: visibleItems.length,
      highConfidence,
      categories: categories.size,
      avgScore,
    }
  }, [visibleItems])

  const handleApprove = (name: string) => {
    toast.success(`Recommendation noted: ${name}`)
  }

  const handleDismiss = (id: string) => {
    setDismissedIds((prev) => new Set(prev).add(id))
  }

  if (error) {
    return (
      <div>
        <AIPageHeader
          title="AI Recommendations"
          subtitle="Intelligent menu and operational suggestions powered by AI"
        />
        <AIErrorState message={error} onRetry={refetch} />
      </div>
    )
  }

  if (loading) {
    return (
      <div>
        <AIPageHeader
          title="AI Recommendations"
          subtitle="Intelligent menu and operational suggestions powered by AI"
        />
        <AILoadingGrid count={4} />
      </div>
    )
  }

  return (
    <div>
      <AIPageHeader
        title="AI Recommendations"
        subtitle="Intelligent menu and operational suggestions powered by AI"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <AIStatCard
          title="Total Recommendations"
          value={stats.total}
          icon={LightBulbIcon}
          color="blue"
        />
        <AIStatCard
          title="High Confidence"
          value={stats.highConfidence}
          subtitle="Score above 80%"
          icon={CheckCircleIcon}
          color="green"
        />
        <AIStatCard
          title="Categories Covered"
          value={stats.categories}
          icon={TagIcon}
          color="purple"
        />
        <AIStatCard
          title="Avg Score"
          value={`${(stats.avgScore * 100).toFixed(1)}%`}
          icon={ChartBarIcon}
          color="amber"
        />
      </div>

      {visibleItems.length === 0 ? (
        <AIEmptyState
          icon={LightBulbIcon}
          title="No Recommendations"
          description="There are no AI recommendations at this time. Check back later for new suggestions."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visibleItems.map((item) => (
            <div
              key={item.menu_item_id}
              className="card hover:shadow-card-hover transition-shadow duration-200"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-slate-900 truncate">
                    {item.name}
                  </h3>
                  <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-50 text-blue-700">
                    {item.category}
                  </span>
                </div>
                <span className="text-sm font-bold text-slate-900 ml-2 whitespace-nowrap">
                  {formatCurrency(item.price)}
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed mb-3">
                {item.reason}
              </p>

              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-slate-500">
                    Confidence
                  </span>
                  <span className="text-xs font-semibold text-slate-700">
                    {(item.score * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      item.score > 0.8
                        ? 'bg-emerald-500'
                        : item.score > 0.5
                          ? 'bg-amber-500'
                          : 'bg-red-400'
                    }`}
                    style={{ width: `${item.score * 100}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleApprove(item.name)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors"
                >
                  <CheckIcon className="w-4 h-4" />
                  Approve
                </button>
                <button
                  onClick={() => handleDismiss(item.menu_item_id)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
                >
                  <XMarkIcon className="w-4 h-4" />
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
