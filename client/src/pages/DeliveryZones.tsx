/**
 * Delivery Zones — owner config for named locality/pincode → fee mapping.
 * Customers get a delivery quote by pincode at checkout based on these.
 */
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { getErrorMessage } from '../api'
import { deliveryZoneApi, DeliveryZone } from '../lib/growthApi'
import Card from '../components/Card'
import Button from '../components/Button'
import Loading from '../components/Loading'
import EmptyState from '../components/EmptyState'
import { MapPinIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline'

interface ZoneForm {
  name: string
  pincode: string
  fee: string
  min_order: string
  eta_minutes: string
}

const emptyForm: ZoneForm = { name: '', pincode: '', fee: '', min_order: '', eta_minutes: '' }

export default function DeliveryZones() {
  const [zones, setZones] = useState<DeliveryZone[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<ZoneForm>(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await deliveryZoneApi.list()
      setZones(res.data.data)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditId(null); setForm(emptyForm); setShowForm(true)
  }
  function openEdit(z: DeliveryZone) {
    setEditId(z.id)
    setForm({
      name: z.name,
      pincode: z.pincode ?? '',
      fee: String(z.fee),
      min_order: String(z.min_order),
      eta_minutes: z.eta_minutes != null ? String(z.eta_minutes) : '',
    })
    setShowForm(true)
  }

  async function save() {
    if (!form.name.trim()) { toast.error('Zone name is required'); return }
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        pincode: form.pincode.trim() || undefined,
        fee: Number(form.fee) || 0,
        min_order: Number(form.min_order) || 0,
        eta_minutes: form.eta_minutes ? Number(form.eta_minutes) : undefined,
      }
      if (editId) {
        await deliveryZoneApi.update(editId, payload)
        toast.success('Zone updated')
      } else {
        await deliveryZoneApi.create(payload)
        toast.success('Zone created')
      }
      setShowForm(false)
      load()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(z: DeliveryZone) {
    try {
      await deliveryZoneApi.update(z.id, { is_active: !z.is_active })
      load()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this delivery zone?')) return
    try {
      await deliveryZoneApi.remove(id)
      toast.success('Zone deleted')
      load()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Delivery Zones</h1>
          <p className="text-sm text-gray-500">Set delivery fees by area / pincode.</p>
        </div>
        <Button variant="primary" onClick={openCreate}>
          <PlusIcon className="h-5 w-5" /> Add Zone
        </Button>
      </div>

      {showForm ? (
        <Card className="space-y-4 p-5">
          <h2 className="font-semibold text-gray-900">{editId ? 'Edit Zone' : 'New Zone'}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Area name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Koramangala" />
            <Field label="Pincode" value={form.pincode} onChange={(v) => setForm({ ...form, pincode: v.replace(/\D/g, '').slice(0, 6) })} placeholder="560034" />
            <Field label="Delivery fee (₹)" value={form.fee} onChange={(v) => setForm({ ...form, fee: v })} type="number" />
            <Field label="Min order (₹)" value={form.min_order} onChange={(v) => setForm({ ...form, min_order: v })} type="number" />
            <Field label="ETA (minutes)" value={form.eta_minutes} onChange={(v) => setForm({ ...form, eta_minutes: v })} type="number" />
          </div>
          <div className="flex gap-2">
            <Button variant="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Card>
      ) : null}

      {loading ? (
        <Loading />
      ) : zones.length === 0 ? (
        <EmptyState
          icon={<MapPinIcon className="h-7 w-7" />}
          title="No delivery zones"
          description="Add a zone so customers can order delivery to their pincode."
        />
      ) : (
        <div className="space-y-3">
          {zones.map((z) => (
            <Card key={z.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{z.name}</span>
                  {z.pincode ? <span className="text-sm text-gray-500">· {z.pincode}</span> : null}
                  {!z.is_active ? <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">Inactive</span> : null}
                </div>
                <p className="mt-1 text-sm text-gray-600">
                  Fee ₹{Number(z.fee).toFixed(0)}
                  {Number(z.min_order) > 0 ? ` · Min ₹${Number(z.min_order).toFixed(0)}` : ''}
                  {z.eta_minutes ? ` · ~${z.eta_minutes} min` : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => toggleActive(z)}>{z.is_active ? 'Disable' : 'Enable'}</Button>
                <Button variant="ghost" onClick={() => openEdit(z)}>Edit</Button>
                <Button variant="danger" onClick={() => remove(z.id)}><TrashIcon className="h-5 w-5" /></Button>
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
