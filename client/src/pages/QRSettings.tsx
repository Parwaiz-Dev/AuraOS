/**
 * QR Settings — Admin page to configure and generate QR codes.
 *
 * Two modes:
 *  - Restaurant: customer scans, picks table, orders. Pays at counter.
 *  - Mall/Food Court: customer scans, enters name + phone, picks payment method.
 */

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import api, { getErrorMessage } from '../api'
import Card from '../components/Card'
import Button from '../components/Button'
import Badge from '../components/Badge'
import Loading from '../components/Loading'
import {
  QrCodeIcon,
  BuildingStorefrontIcon,
  ShoppingBagIcon,
  ArrowDownTrayIcon,
  PrinterIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  ReceiptPercentIcon,
} from '@heroicons/react/24/outline'

type QRMode = 'restaurant' | 'mall'

interface Restaurant {
  id: string
  name: string
  slug: string
  qr_mode: QRMode
  gstin: string | null
  tax_rate: number
  tax_inclusive: boolean
}

// ── Tiny inline QR renderer using a public QR API (no npm package needed) ──
// We use the Google Charts QR API which is free and reliable.
function QRImage({ url, size = 280 }: { url: string; size?: number }) {
  const encoded = encodeURIComponent(url)
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&margin=10&color=1f2937&bgcolor=ffffff`
  return (
    <img
      src={src}
      alt="QR Code"
      width={size}
      height={size}
      className="rounded-xl border border-gray-200"
    />
  )
}

const QRSettings: React.FC = () => {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [mode, setMode] = useState<QRMode>('restaurant')

  // GST state
  const [gstin, setGstin] = useState('')
  const [taxRate, setTaxRate] = useState(5)
  const [taxInclusive, setTaxInclusive] = useState(false)
  const [savingGst, setSavingGst] = useState(false)

  // The URL customers will scan
  const baseUrl = window.location.origin
  const customerUrl = `${baseUrl}/customer?slug=${restaurant?.slug || 'demo-kitchen'}`

  useEffect(() => {
    api.get('/restaurants/me')
      .then((res) => {
        const r = res.data.data
        setRestaurant(r)
        setMode(r.qr_mode || 'restaurant')
        setGstin(r.gstin || '')
        setTaxRate(Number(r.tax_rate ?? 5))
        setTaxInclusive(Boolean(r.tax_inclusive))
      })
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.put('/restaurants/me', { qr_mode: mode })
      setRestaurant((r) => r ? { ...r, qr_mode: mode } : r)
      toast.success('QR mode saved')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleSaveGst = async () => {
    setSavingGst(true)
    try {
      await api.put('/restaurants/me', {
        gstin: gstin.trim() || null,
        tax_rate: taxRate,
        tax_inclusive: taxInclusive,
      })
      toast.success('GST settings saved')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSavingGst(false)
    }
  }

  const handleDownload = () => {
    const size = 600
    const encoded = encodeURIComponent(customerUrl)
    const src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&margin=20&color=1f2937&bgcolor=ffffff`
    const a = document.createElement('a')
    a.href = src
    a.download = `auraos-qr-${restaurant?.slug || 'menu'}.png`
    a.target = '_blank'
    a.click()
  }

  const handlePrint = () => {
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR Code — ${restaurant?.name}</title>
        <style>
          body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: white; }
          .container { text-align: center; padding: 40px; }
          h1 { font-size: 28px; font-weight: 700; color: #1f2937; margin-bottom: 8px; }
          p { font-size: 16px; color: #6b7280; margin-bottom: 32px; }
          img { border-radius: 16px; border: 2px solid #e5e7eb; }
          .url { margin-top: 24px; font-size: 12px; color: #9ca3af; word-break: break-all; max-width: 300px; }
          .badge { display: inline-block; margin-top: 16px; padding: 6px 16px; background: #eef2ff; color: #4f46e5; border-radius: 999px; font-size: 13px; font-weight: 600; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>${restaurant?.name}</h1>
          <p>${mode === 'restaurant' ? 'Scan to order from your table' : 'Scan to order & pay'}</p>
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(customerUrl)}&margin=20&color=1f2937&bgcolor=ffffff" width="400" height="400" />
          <div class="badge">${mode === 'restaurant' ? '🍽️ Dine-In Ordering' : '🛍️ Food Court Ordering'}</div>
          <div class="url">${customerUrl}</div>
        </div>
      </body>
      </html>
    `
    const win = window.open('', '_blank')
    if (win) {
      win.document.write(printContent)
      win.document.close()
      win.focus()
      setTimeout(() => win.print(), 500)
    }
  }

  if (loading) return <Loading text="Loading settings…" />

  const modeChanged = mode !== (restaurant?.qr_mode || 'restaurant')

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">QR Code Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Generate a QR code for customers to scan and order directly
        </p>
      </div>

      {/* GST Settings */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <ReceiptPercentIcon className="w-5 h-5 text-indigo-500" />
          <h2 className="font-semibold text-gray-900">GST / Tax Settings</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">GSTIN</label>
            <input
              type="text"
              maxLength={15}
              placeholder="e.g. 27AAAAA0000A1Z5"
              value={gstin}
              onChange={(e) => setGstin(e.target.value.toUpperCase())}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
            <p className="text-xs text-gray-400 mt-1">Printed on customer bills</p>
          </div>
          <div>
            <label htmlFor="tax-rate" className="block text-sm font-medium text-gray-700 mb-1">Tax Rate (%)</label>
            <select
              id="tax-rate"
              value={taxRate}
              onChange={(e) => setTaxRate(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value={0}>0% — Exempt</option>
              <option value={5}>5% — Non-AC restaurant</option>
              <option value={12}>12%</option>
              <option value={18}>18% — AC / with bar</option>
              <option value={28}>28% — Luxury</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">Split as CGST + SGST on bill</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Price Display</label>
            <div className="flex items-center gap-3 h-10">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={taxInclusive}
                  onChange={(e) => setTaxInclusive(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">Tax inclusive</span>
              </label>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {taxInclusive ? 'GST is included in item prices' : 'GST added on top of item prices'}
            </p>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="primary" size="sm" isLoading={savingGst} onClick={handleSaveGst}>
            Save GST Settings
          </Button>
        </div>
      </Card>

      {/* Mode selector */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Restaurant mode */}
        <button
          onClick={() => setMode('restaurant')}
          className={`text-left p-5 rounded-2xl border-2 transition-all ${
            mode === 'restaurant'
              ? 'border-indigo-500 bg-indigo-50'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
              mode === 'restaurant' ? 'bg-indigo-100' : 'bg-gray-100'
            }`}>
              <BuildingStorefrontIcon className={`w-6 h-6 ${mode === 'restaurant' ? 'text-indigo-600' : 'text-gray-500'}`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900">Restaurant Mode</h3>
                {mode === 'restaurant' && (
                  <CheckCircleIcon className="w-5 h-5 text-indigo-600" />
                )}
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Customer scans QR, selects their table number, browses menu and places order.
                Payment is collected at the counter.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {['Table selection', 'Pay at counter', 'Dine-in'].map((tag) => (
                  <span key={tag} className="text-xs px-2 py-0.5 bg-white border border-gray-200 rounded-full text-gray-600">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </button>

        {/* Mall mode */}
        <button
          onClick={() => setMode('mall')}
          className={`text-left p-5 rounded-2xl border-2 transition-all ${
            mode === 'mall'
              ? 'border-indigo-500 bg-indigo-50'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
              mode === 'mall' ? 'bg-indigo-100' : 'bg-gray-100'
            }`}>
              <ShoppingBagIcon className={`w-6 h-6 ${mode === 'mall' ? 'text-indigo-600' : 'text-gray-500'}`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900">Mall / Food Court Mode</h3>
                {mode === 'mall' && (
                  <CheckCircleIcon className="w-5 h-5 text-indigo-600" />
                )}
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Customer enters name + phone, picks payment method (UPI, Card, Online, or Pay at Counter).
                No table selection needed.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {['Name + Phone', 'UPI / Card / Online', 'Pay at Counter', 'Takeaway'].map((tag) => (
                  <span key={tag} className="text-xs px-2 py-0.5 bg-white border border-gray-200 rounded-full text-gray-600">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </button>
      </div>

      {/* Save button */}
      {modeChanged && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <InformationCircleIcon className="w-5 h-5 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-700 flex-1">
            You've changed the mode. Save to apply — the QR URL stays the same, only the customer experience changes.
          </p>
          <Button variant="primary" size="sm" isLoading={saving} onClick={handleSave}>
            Save Mode
          </Button>
        </div>
      )}

      {/* QR Code display */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* QR preview */}
        <Card className="flex flex-col items-center text-center gap-4">
          <div className="flex items-center gap-2">
            <QrCodeIcon className="w-5 h-5 text-gray-400" />
            <h2 className="font-semibold text-gray-900">Your QR Code</h2>
            <Badge variant={mode === 'restaurant' ? 'info' : 'purple'}>
              {mode === 'restaurant' ? 'Restaurant' : 'Mall'}
            </Badge>
          </div>

          <QRImage url={customerUrl} size={240} />

          <div className="w-full bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-400 mb-1">Customer URL</p>
            <p className="text-xs font-mono text-gray-700 break-all">{customerUrl}</p>
          </div>

          <div className="flex gap-3 w-full">
            <Button
              variant="outline"
              fullWidth
              leftIcon={<ArrowDownTrayIcon className="w-4 h-4" />}
              onClick={handleDownload}
            >
              Download
            </Button>
            <Button
              variant="primary"
              fullWidth
              leftIcon={<PrinterIcon className="w-4 h-4" />}
              onClick={handlePrint}
            >
              Print
            </Button>
          </div>
        </Card>

        {/* What customers see */}
        <Card>
          <h2 className="font-semibold text-gray-900 mb-4">What customers will see</h2>
          <div className="space-y-3">
            {mode === 'restaurant' ? (
              <>
                {[
                  { step: '1', title: 'Scan QR code', desc: 'Customer scans the QR at their table' },
                  { step: '2', title: 'Enter table number', desc: 'They type their table number (T1, T2, etc.)' },
                  { step: '3', title: 'Browse & add items', desc: 'Full menu with categories, search, veg filter' },
                  { step: '4', title: 'Place order', desc: 'Order goes directly to kitchen' },
                  { step: '5', title: 'Pay at counter', desc: 'Staff collects payment when food is served' },
                ].map((s) => (
                  <div key={s.step} className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">
                      {s.step}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{s.title}</p>
                      <p className="text-xs text-gray-500">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <>
                {[
                  { step: '1', title: 'Scan QR code', desc: 'Customer scans the QR at the counter or table tent' },
                  { step: '2', title: 'Enter name & phone', desc: 'Required for order tracking and notification' },
                  { step: '3', title: 'Browse & add items', desc: 'Full menu with categories, search, veg filter' },
                  { step: '4', title: 'Choose payment', desc: 'UPI, Card, Online, or Pay at Counter' },
                  { step: '5', title: 'Place order', desc: 'Order goes to kitchen, payment recorded' },
                ].map((s) => (
                  <div key={s.step} className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 font-bold text-xs flex items-center justify-center shrink-0">
                      {s.step}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{s.title}</p>
                      <p className="text-xs text-gray-500">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          <div className="mt-5 p-3 bg-gray-50 rounded-xl">
            <p className="text-xs text-gray-500">
              <span className="font-medium text-gray-700">One QR for everything.</span>{' '}
              The same QR code works for both modes — just change the mode above and save.
              No need to reprint the QR.
            </p>
          </div>
        </Card>
      </div>

      {/* Test link */}
      <Card padding="sm" className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-900">Test the customer experience</p>
          <p className="text-xs text-gray-500">Opens the customer ordering page in a new tab</p>
        </div>
        <a
          href={customerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
        >
          Open Customer App →
        </a>
      </Card>
    </div>
  )
}

export default QRSettings
