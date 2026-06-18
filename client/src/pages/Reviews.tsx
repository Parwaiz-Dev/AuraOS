/**
 * Reviews — owner moderation: see all customer reviews, hide/show, or delete.
 */
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { getErrorMessage } from '../api'
import { reviewApi, OwnerReview } from '../lib/growthApi'
import Card from '../components/Card'
import Button from '../components/Button'
import Loading from '../components/Loading'
import EmptyState from '../components/EmptyState'
import { StarIcon, TrashIcon } from '@heroicons/react/24/outline'

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-amber-500">
      {'★'.repeat(rating)}
      <span className="text-gray-300">{'★'.repeat(5 - rating)}</span>
    </span>
  )
}

export default function Reviews() {
  const [reviews, setReviews] = useState<OwnerReview[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await reviewApi.list()
      setReviews(res.data.data)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function togglePublished(r: OwnerReview) {
    try {
      await reviewApi.setPublished(r.id, !r.is_published)
      toast.success(r.is_published ? 'Review hidden' : 'Review published')
      load()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this review permanently?')) return
    try {
      await reviewApi.remove(id)
      toast.success('Review deleted')
      load()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const avg = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : '—'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reviews</h1>
        <p className="text-sm text-gray-500">
          {reviews.length} reviews · average rating {avg}
        </p>
      </div>

      {loading ? (
        <Loading />
      ) : reviews.length === 0 ? (
        <EmptyState
          icon={<StarIcon className="h-7 w-7" />}
          title="No reviews yet"
          description="Customer reviews from your website will appear here."
        />
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <Card key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Stars rating={r.rating} />
                  <span className="text-sm font-medium text-gray-900">{r.customer_name || 'Anonymous'}</span>
                  {!r.is_published ? <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">Hidden</span> : null}
                </div>
                {r.title ? <p className="mt-1 font-semibold text-gray-800">{r.title}</p> : null}
                {r.body ? <p className="mt-1 text-sm text-gray-600">{r.body}</p> : null}
                <p className="mt-1 text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => togglePublished(r)}>
                  {r.is_published ? 'Hide' : 'Publish'}
                </Button>
                <Button variant="danger" onClick={() => remove(r.id)}><TrashIcon className="h-5 w-5" /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
