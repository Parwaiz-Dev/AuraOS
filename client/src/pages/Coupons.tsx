/**
 * Coupons — owner management of promo codes (flat/percent, limits, validity).
 */
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { getErrorMessage } from '../api'
import { couponApi, Coupon } from '../lib/growthApi'
import Card from '../components/Card'
import Button from '../components/Button'
import Loading from '../components/Loading'
import EmptyState from '../components/EmptyState'
import { TicketIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline'

interface CouponForm {
  code: string
  description: string
  discount_type: 'FLAT' | 'PERCENT'
  discount_value: string
  min_order: string
  max_discount: string
  usage_limit: string
}

const emptyForm: CouponForm = {
  code: '', description: '', discount_type: 'FLAT',
  discount_value: '', min_order: '', max_discount: '', usage_limit: '',
}

export default function Coupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<CouponForm>(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await couponApi.list()
      setCoupons(res.data.data)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function openCreate() { setEditId(null); setForm(emptyForm); setShowForm(true) }
  function openEdit(c: Coupon) {
    setEditId(c.id)
    setForm({
      code: c.code,
      description: c.description ?? '',
      discount_type: c.discount_type,
      discount_value: String(c.discount_value),
      min_order: String(c.min_order),
      max_discount: c.max_discount != null ? String(c.max_discount) : '',
      usage_limit: c.usage_limit != null ? String(c.usage_limit) : '',
    })
    setShowForm(true)
  }

  async function save() {
    if (!form.code.trim()) { toast.error('Code is required'); return }
    setSaving(true)
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        description: form.description.trim() || undefined,
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value) || 0,
        min_order: Number(form.min_order) || 0,
        max_discount: form.max_discount ? Number(form.max_discount) : undefined,
        usage_limit: form.usage_limit ? Number(form.usage_limit) : undefined,
      }
      if (editId) {
        await couponApi.update(editId, payload)
        toast.success('Coupon updated')
      } else {
        await couponApi.create(payload)
        toast.success('Coupon created')
      }
      setShowForm(false)
      load()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(c: Coupon) {
    try {
      await couponApi.update(c.id, { is_active: !c.is_active })
      load()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this coupon?')) return
    try {
      await couponApi.remove(id)
      toast.success('Coupon deleted')
      load()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Coupons</h1>
          <p className="text-sm text-gray-500">Promo codes customers apply at checkout.</p>
        </div>
        <Button variant="primary" onClick={openCreate}>
          <PlusIcon className="h-5 w-5" /> Add Coupon
        </Button>
      </div>

      {showForm ? (
        <Card className="space-y-4 p-5">
          <h2 className="font-semibold text-gray-900">{editId ? 'Edit Coupon' : 'New Coupon'}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Code" value={form.code} onChange={(v) => setForm({ ...form, code: v.toUpperCase() })} placeholder="WELCOME20" />
            <Field label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} placeholder="20% off first order" />
            <label className="block">
              <span className="block text-sm font-medium text-gray-700">Type</span>
              <select
                value={form.discount_type}
                onChange={(e) => setForm({ ...form, discount_type: e.target.value as 'FLAT' | 'PERCENT' })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                <option value="FLAT">Flat (₹)</option>
                <option value="PERCENT">Percent (%)</option>
              </select>
            </label>
            <Field label={form.discount_type === 'PERCENT' ? 'Discount (%)' : 'Discount (₹)'} value={form.discount_value} onChange={(v) => setForm({ ...form, discount_value: v })} type="number" />
            <Field label="Min order (₹)" value={form.min_order} onChange={(v) => setForm({ ...form, min_order: v })} type="number" />
            {form.discount_type === 'PERCENT' ? (
              <Field label="Max discount (₹)" value={form.max_discount} onChange={(v) => setForm({ ...form, max_discount: v })} type="number" />
            ) : null}
            <Field label="Usage limit (blank = unlimited)" value={form.usage_limit} onChange={(v) => setForm({ ...form, usage_limit: v })} type="number" />
          </div>
          <div className="flex gap-2">
            <Button variant="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Card>
      ) : null}

      {loading ? (
        <Loading />
      ) : coupons.length === 0 ? (
        <EmptyState
          icon={<TicketIcon className="h-7 w-7" />}
          title="No coupons yet"
          description="Create a promo code to offer discounts at checkout."
        />
      ) : (
        <div className="space-y-3">
          {coupons.map((c) => (
            <Card key={c.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-gray-900">{c.code}</span>
                  {!c.is_active ? <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">Inactive</span> : null}
                </div>
                <p className="mt-1 text-sm text-gray-600">
                  {c.discount_type === 'PERCENT' ? `${c.discount_value}% off` : `₹${c.discount_value} off`}
                  {Number(c.min_order) > 0 ? ` · Min ₹${Number(c.min_order).toFixed(0)}` : ''}
                  {c.usage_limit != null ? ` · ${c.used_count}/${c.usage_limit} used` : ` · ${c.used_count} used`}
                </p>
                {c.description ? <p className="mt-0.5 text-sm text-gray-400">{c.description}</p> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => toggleActive(c)}>{c.is_active ? 'Disable' : 'Enable'}</Button>
                <Button variant="ghost" onClick={() => openEdit(c)}>Edit</Button>
                <Button variant="danger" onClick={() => remove(c.id)}><TrashIcon className="h-5 w-5" /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function Field({
  label, value, onChange, placeholder, type = 'text',
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
      />
    </label>
  )
}
