/**
 * Loyalty — owner settings: enable the program and set earn/redeem rates.
 *   points_per_currency: points earned per ₹1 spent (0.1 => ₹1000 = 100 pts)
 *   redeem_value:        ₹ value of 1 point (1 => 100 pts = ₹100)
 */
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { getErrorMessage } from '../api'
import { loyaltyApi } from '../lib/growthApi'
import Card from '../components/Card'
import Button from '../components/Button'
import Loading from '../components/Loading'

export default function Loyalty() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [pointsPer, setPointsPer] = useState('0.1')
  const [redeemValue, setRedeemValue] = useState('1')

  useEffect(() => {
    (async () => {
      try {
        const res = await loyaltyApi.getConfig()
        const c = res.data.data
        setEnabled(!!c.loyalty_enabled)
        setPointsPer(String(c.loyalty_points_per_currency))
        setRedeemValue(String(c.loyalty_redeem_value))
      } catch (err) {
        toast.error(getErrorMessage(err))
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  async function save() {
    setSaving(true)
    try {
      await loyaltyApi.updateConfig({
        loyalty_enabled: enabled,
        loyalty_points_per_currency: Number(pointsPer) || 0,
        loyalty_redeem_value: Number(redeemValue) || 0,
      })
      toast.success('Loyalty settings saved')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Loading />

  // Worked example for the owner to sanity-check their rates.
  const ppc = Number(pointsPer) || 0
  const rv = Number(redeemValue) || 0
  const earnExample = Math.floor(1000 * ppc)
  const redeemExample = (earnExample * rv).toFixed(0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Loyalty Program</h1>
        <p className="text-sm text-gray-500">Reward repeat customers with points.</p>
      </div>

      <Card className="max-w-xl space-y-5 p-6">
        <label className="flex items-center justify-between">
          <span className="font-medium text-gray-800">Enable loyalty program</span>
          <button
            type="button"
            onClick={() => setEnabled((v) => !v)}
            className={`relative h-6 w-11 rounded-full transition ${enabled ? 'bg-emerald-500' : 'bg-gray-300'}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${enabled ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="block text-sm font-medium text-gray-700">Points earned per ₹1</span>
            <input
              type="number" step="0.01" value={pointsPer}
              onChange={(e) => setPointsPer(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-gray-700">₹ value per point</span>
            <input
              type="number" step="0.01" value={redeemValue}
              onChange={(e) => setRedeemValue(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </label>
        </div>

        <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
          <p className="font-medium text-gray-700">Example</p>
          <p>A customer spending ₹1000 earns <b>{earnExample} points</b>, worth <b>₹{redeemExample}</b> off future orders.</p>
        </div>

        <Button variant="primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save Settings'}
        </Button>
      </Card>
    </div>
  )
}
