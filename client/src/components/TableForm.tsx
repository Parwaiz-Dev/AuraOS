import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import api, { getErrorMessage } from '../api'
import { Table } from '../types/table'
import Modal from './Modal'
import Button from './Button'
import Input from './Input'

interface TableFormProps {
  table?: Table
  onClose: () => void
  onSave: (table: Table) => void
}

const QUICK_NAMES = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10',
  'VIP 1', 'VIP 2', 'Outdoor 1', 'Bar 1', 'Counter 1']

const TableForm: React.FC<TableFormProps> = ({ table, onClose, onSave }) => {
  const [tableNumber, setTableNumber] = useState(table?.table_number || '')
  const [seats, setSeats] = useState(table?.seats || 2)
  const [isActive, setIsActive] = useState(table?.is_active ?? true)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (table) {
      setTableNumber(table.table_number)
      setSeats(table.seats)
      setIsActive(table.is_active)
    }
  }, [table])

  const validate = () => {
    const errs: Record<string, string> = {}
    const trimmed = tableNumber.trim()
    if (!trimmed) {
      errs.tableNumber = 'Table name is required'
    } else if (trimmed.length > 50) {
      errs.tableNumber = 'Table name must be under 50 characters'
    } else if (!/^[a-zA-Z0-9\s\-_]+$/.test(trimmed)) {
      errs.tableNumber = 'Only letters, numbers, spaces, hyphens and underscores allowed'
    }
    if (!seats || seats < 1) errs.seats = 'Must have at least 1 seat'
    if (seats > 50) errs.seats = 'Maximum 50 seats per table'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      const url = table ? `/tables/${table.id}` : '/tables'
      const res = table
        ? await api.patch(url, { table_number: tableNumber.trim(), seats, is_active: isActive })
        : await api.post(url, { table_number: tableNumber.trim(), seats, is_active: isActive })
      onSave(res.data.data)
      onClose()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={table ? `Edit Table — ${table.table_number}` : 'Add New Table'}
      size="sm"
      footer={
        <div className="flex gap-3">
          <Button type="submit" form="table-form" variant="primary" fullWidth isLoading={saving}>
            {table ? 'Save Changes' : 'Create Table'}
          </Button>
          <Button variant="outline" fullWidth onClick={onClose}>
            Cancel
          </Button>
        </div>
      }
    >
      <form id="table-form" onSubmit={handleSubmit} className="space-y-5">
        {/* Table name */}
        <div>
          <Input
            label="Table Name / Number"
            placeholder="e.g. T1, VIP 1, Outdoor 2"
            value={tableNumber}
            onChange={(e) => setTableNumber(e.target.value)}
            error={errors.tableNumber}
            hint="Use a short, recognisable name for your staff"
            required
            fullWidth
          />
          {/* Quick-pick chips */}
          {!table && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {QUICK_NAMES.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setTableNumber(name)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${
                    tableNumber === name
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Seats */}
        <div>
          <label className="form-label">
            Seating Capacity <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-3 mt-1">
            <button
              type="button"
              onClick={() => setSeats((s) => Math.max(1, s - 1))}
              className="w-9 h-9 rounded-lg border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors text-lg font-medium"
            >
              −
            </button>
            <span className="text-2xl font-bold text-gray-900 w-10 text-center">{seats}</span>
            <button
              type="button"
              onClick={() => setSeats((s) => Math.min(50, s + 1))}
              className="w-9 h-9 rounded-lg border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors text-lg font-medium"
            >
              +
            </button>
            <span className="text-sm text-gray-400 ml-1">seats</span>
          </div>
          {/* Quick seat presets */}
          <div className="flex gap-2 mt-2">
            {[2, 4, 6, 8, 10].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setSeats(n)}
                className={`px-3 py-1 text-xs font-medium rounded-lg border transition-colors ${
                  seats === n
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-indigo-300'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          {errors.seats && <p className="text-xs text-red-600 mt-1">{errors.seats}</p>}
        </div>

        {/* Active toggle */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
          <div>
            <p className="text-sm font-medium text-gray-900">Active</p>
            <p className="text-xs text-gray-500">Inactive tables won't appear in order taking</p>
          </div>
          <button
            type="button"
            onClick={() => setIsActive((v) => !v)}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              isActive ? 'bg-indigo-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                isActive ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default TableForm
