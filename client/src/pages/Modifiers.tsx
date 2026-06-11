import { useEffect, useState, useMemo } from 'react'
import toast from 'react-hot-toast'
import api, { getErrorMessage } from '../api'
import Button from '../components/Button'
import Input from '../components/Input'
import Modal from '../components/Modal'
import Card from '../components/Card'
import Badge from '../components/Badge'
import EmptyState from '../components/EmptyState'
import Loading from '../components/Loading'
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  TagIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ModifierOption {
  id: string
  modifier_group_id: string
  name: string
  price_adjustment: number
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

interface ModifierGroup {
  id: string
  restaurant_id: string
  name: string
  selection_type: 'single' | 'multiple'
  min_select: number
  max_select: number
  sort_order: number
  is_active: boolean
  options?: ModifierOption[]
  created_at: string
  updated_at: string
}

interface GroupFormData {
  name: string
  selection_type: 'single' | 'multiple'
  min_select: number
  max_select: number
}

interface OptionFormData {
  name: string
  price_adjustment: number
}

const defaultGroupForm: GroupFormData = {
  name: '',
  selection_type: 'single',
  min_select: 0,
  max_select: 1,
}

const defaultOptionForm: OptionFormData = {
  name: '',
  price_adjustment: 0,
}

// ── Component ──────────────────────────────────────────────────────────────────

const Modifiers: React.FC = () => {
  const [groups, setGroups] = useState<ModifierGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Group form
  const [groupFormOpen, setGroupFormOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<ModifierGroup | null>(null)
  const [groupForm, setGroupForm] = useState<GroupFormData>(defaultGroupForm)
  const [savingGroup, setSavingGroup] = useState(false)

  // Option form
  const [optionFormOpen, setOptionFormOpen] = useState(false)
  const [editingOption, setEditingOption] = useState<ModifierOption | null>(null)
  const [activeGroupId, setActiveGroupId] = useState<string>('')
  const [optionForm, setOptionForm] = useState<OptionFormData>(defaultOptionForm)
  const [savingOption, setSavingOption] = useState(false)

  // Expanded groups tracking
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  // ── Fetch ────────────────────────────────────────────────────────────────────

  const fetchGroups = async () => {
    try {
      const res = await api.get('/modifiers/groups')
      setGroups(res.data.data || [])
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchGroups() }, [])

  // Expand first group by default on load
  useEffect(() => {
    if (groups.length > 0 && expandedGroups.size === 0) {
      setExpandedGroups(new Set([groups[0].id]))
    }
  }, [groups])

  // ── Filter ───────────────────────────────────────────────────────────────────

  const filteredGroups = useMemo(() => {
    if (!search) return groups
    const q = search.toLowerCase()
    return groups.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        (g.options || []).some((o) => o.name.toLowerCase().includes(q))
    )
  }, [groups, search])

  // ── Expand / Collapse ────────────────────────────────────────────────────────

  const toggleExpand = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  // ── Group CRUD ───────────────────────────────────────────────────────────────

  const openCreateGroup = () => {
    setEditingGroup(null)
    setGroupForm(defaultGroupForm)
    setGroupFormOpen(true)
  }

  const openEditGroup = (group: ModifierGroup) => {
    setEditingGroup(group)
    setGroupForm({
      name: group.name,
      selection_type: group.selection_type,
      min_select: group.min_select,
      max_select: group.max_select,
    })
    setGroupFormOpen(true)
  }

  const handleGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingGroup(true)
    try {
      if (editingGroup) {
        const res = await api.put(`/modifiers/groups/${editingGroup.id}`, groupForm)
        setGroups((p) =>
          p.map((g) => (g.id === editingGroup.id ? { ...g, ...res.data.data } : g))
        )
        toast.success('Modifier group updated')
      } else {
        const res = await api.post('/modifiers/groups', groupForm)
        setGroups((p) => [...p, res.data.data])
        toast.success('Modifier group created')
      }
      setGroupFormOpen(false)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSavingGroup(false)
    }
  }

  const handleDeleteGroup = async (group: ModifierGroup) => {
    if (!confirm(`Delete modifier group "${group.name}"? This will also delete all its options.`)) return
    try {
      await api.delete(`/modifiers/groups/${group.id}`)
      setGroups((p) => p.filter((g) => g.id !== group.id))
      toast.success('Modifier group deleted')
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  // ── Option CRUD ──────────────────────────────────────────────────────────────

  const openCreateOption = (groupId: string) => {
    setActiveGroupId(groupId)
    setEditingOption(null)
    setOptionForm(defaultOptionForm)
    setOptionFormOpen(true)
  }

  const openEditOption = (groupId: string, option: ModifierOption) => {
    setActiveGroupId(groupId)
    setEditingOption(option)
    setOptionForm({
      name: option.name,
      price_adjustment: option.price_adjustment,
    })
    setOptionFormOpen(true)
  }

  const handleOptionSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingOption(true)
    try {
      if (editingOption) {
        const res = await api.put(`/modifiers/options/${editingOption.id}`, optionForm)
        setGroups((p) =>
          p.map((g) => {
            if (g.id !== activeGroupId) return g
            return {
              ...g,
              options: (g.options || []).map((o) =>
                o.id === editingOption.id ? { ...o, ...res.data.data } : o
              ),
            }
          })
        )
        toast.success('Option updated')
      } else {
        const res = await api.post(
          `/modifiers/groups/${activeGroupId}/options`,
          optionForm
        )
        setGroups((p) =>
          p.map((g) => {
            if (g.id !== activeGroupId) return g
            return {
              ...g,
              options: [...(g.options || []), res.data.data],
            }
          })
        )
        toast.success('Option added')
      }
      setOptionFormOpen(false)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSavingOption(false)
    }
  }

  const handleDeleteOption = async (groupId: string, option: ModifierOption) => {
    if (!confirm(`Delete option "${option.name}"?`)) return
    try {
      await api.delete(`/modifiers/options/${option.id}`)
      setGroups((p) =>
        p.map((g) => {
          if (g.id !== groupId) return g
          return {
            ...g,
            options: (g.options || []).filter((o) => o.id !== option.id),
          }
        })
      )
      toast.success('Option deleted')
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  // ── Format helpers ───────────────────────────────────────────────────────────

  const formatPrice = (price: number) => {
    if (price === 0) return '₹0'
    if (price > 0) return `+₹${price.toFixed(2)}`
    return `-₹${Math.abs(price).toFixed(2)}`
  }

  const selectionTypeLabel = (type: 'single' | 'multiple') =>
    type === 'single' ? 'Single Select' : 'Multiple Select'

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) return <Loading text="Loading modifiers…" />

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Modifiers</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {groups.length} group{groups.length !== 1 ? 's' : ''} — configure
            add-ons, variants, and customizations
          </p>
        </div>
        <Button
          variant="primary"
          leftIcon={<PlusIcon className="w-4 h-4" />}
          onClick={openCreateGroup}
        >
          Add Modifier Group
        </Button>
      </div>

      {/* Search */}
      <Card padding="sm">
        <Input
          placeholder="Search groups or options…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<MagnifyingGlassIcon className="w-4 h-4" />}
          fullWidth
        />
      </Card>

      {/* Groups List */}
      {filteredGroups.length === 0 ? (
        <Card>
          <EmptyState
            icon={<TagIcon className="w-7 h-7" />}
            title="No modifier groups found"
            description='Create your first modifier group (e.g., "Size" or "Milk") to get started.'
            action={{ label: 'Add Modifier Group', onClick: openCreateGroup }}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredGroups.map((group) => {
            const isExpanded = expandedGroups.has(group.id)
            const options = group.options || []
            return (
              <Card key={group.id} padding="none">
                {/* Group Header */}
                <div className="flex items-center gap-3 px-5 py-4">
                  {/* Expand toggle */}
                  <button
                    onClick={() => toggleExpand(group.id)}
                    className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label={isExpanded ? 'Collapse' : 'Expand'}
                  >
                    {isExpanded ? (
                      <ChevronDownIcon className="w-5 h-5" />
                    ) : (
                      <ChevronRightIcon className="w-5 h-5" />
                    )}
                  </button>

                  {/* Group info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{group.name}</span>
                      <Badge variant={group.selection_type === 'single' ? 'info' : 'purple'}>
                        {selectionTypeLabel(group.selection_type)}
                      </Badge>
                      {!group.is_active && <Badge variant="default">Inactive</Badge>}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                      {group.selection_type === 'multiple' && (
                        <>
                          <span>Min: {group.min_select}</span>
                          <span>Max: {group.max_select}</span>
                        </>
                      )}
                      <span>{options.length} option{options.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditGroup(group)}
                      leftIcon={<PencilIcon className="w-4 h-4" />}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteGroup(group)}
                      leftIcon={<TrashIcon className="w-4 h-4 text-red-500" />}
                      className="text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </Button>
                  </div>
                </div>

                {/* Options (expanded) */}
                {isExpanded && (
                  <div className="border-t border-slate-100">
                    {options.length === 0 ? (
                      <div className="px-5 py-6 text-center text-sm text-gray-400">
                        No options yet.{' '}
                        <button
                          onClick={() => openCreateOption(group.id)}
                          className="text-brand-600 hover:text-brand-700 font-medium"
                        >
                          Add one
                        </button>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Option</th>
                              <th>Price Adjustment</th>
                              <th>Status</th>
                              <th className="w-28">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {options
                              .sort((a, b) => a.sort_order - b.sort_order)
                              .map((opt) => (
                                <tr key={opt.id}>
                                  <td>
                                    <span className="font-medium text-gray-900">
                                      {opt.name}
                                    </span>
                                  </td>
                                  <td>
                                    <Badge
                                      variant={
                                        opt.price_adjustment > 0
                                          ? 'success'
                                          : opt.price_adjustment < 0
                                          ? 'error'
                                          : 'default'
                                      }
                                    >
                                      {formatPrice(opt.price_adjustment)}
                                    </Badge>
                                  </td>
                                  <td>
                                    <Badge
                                      variant={opt.is_active ? 'success' : 'default'}
                                      dot
                                    >
                                      {opt.is_active ? 'Active' : 'Inactive'}
                                    </Badge>
                                  </td>
                                  <td>
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => openEditOption(group.id, opt)}
                                        className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                                        title="Edit option"
                                      >
                                        <PencilIcon className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteOption(group.id, opt)}
                                        className="p-1.5 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                                        title="Delete option"
                                      >
                                        <TrashIcon className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {/* Add option footer */}
                    <div className="px-5 py-3 border-t border-slate-50 bg-slate-50/50">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openCreateOption(group.id)}
                        leftIcon={<PlusIcon className="w-4 h-4" />}
                      >
                        Add Option
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* ── Group Form Modal ────────────────────────────────────────────────── */}
      <Modal
        isOpen={groupFormOpen}
        onClose={() => setGroupFormOpen(false)}
        title={editingGroup ? 'Edit Modifier Group' : 'Create Modifier Group'}
        size="md"
        footer={
          <div className="flex gap-3">
            <Button
              type="submit"
              form="group-form"
              variant="primary"
              fullWidth
              isLoading={savingGroup}
            >
              {editingGroup ? 'Save Changes' : 'Create Group'}
            </Button>
            <Button variant="outline" fullWidth onClick={() => setGroupFormOpen(false)}>
              Cancel
            </Button>
          </div>
        }
      >
        <form id="group-form" onSubmit={handleGroupSubmit} className="space-y-4">
          <Input
            label="Group Name"
            placeholder='e.g., Size, Milk, Toppings'
            value={groupForm.name}
            onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
            required
            fullWidth
          />
          <div>
            <label className="form-label">Selection Type</label>
            <select
              value={groupForm.selection_type}
              onChange={(e) =>
                setGroupForm({
                  ...groupForm,
                  selection_type: e.target.value as 'single' | 'multiple',
                })
              }
              className="form-select w-full"
            >
              <option value="single">Single Select — choose exactly one</option>
              <option value="multiple">Multiple Select — choose any number</option>
            </select>
          </div>
          {groupForm.selection_type === 'multiple' && (
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Min Selections"
                type="number"
                min={0}
                value={groupForm.min_select}
                onChange={(e) =>
                  setGroupForm({
                    ...groupForm,
                    min_select: Math.max(0, parseInt(e.target.value) || 0),
                  })
                }
                hint="Minimum number of options the customer must pick"
                fullWidth
              />
              <Input
                label="Max Selections"
                type="number"
                min={1}
                value={groupForm.max_select}
                onChange={(e) =>
                  setGroupForm({
                    ...groupForm,
                    max_select: Math.max(1, parseInt(e.target.value) || 1),
                  })
                }
                hint="Maximum number of options allowed"
                fullWidth
              />
            </div>
          )}
        </form>
      </Modal>

      {/* ── Option Form Modal ────────────────────────────────────────────────── */}
      <Modal
        isOpen={optionFormOpen}
        onClose={() => setOptionFormOpen(false)}
        title={editingOption ? 'Edit Option' : 'Add Option'}
        size="sm"
        footer={
          <div className="flex gap-3">
            <Button
              type="submit"
              form="option-form"
              variant="primary"
              fullWidth
              isLoading={savingOption}
            >
              {editingOption ? 'Save Changes' : 'Add Option'}
            </Button>
            <Button variant="outline" fullWidth onClick={() => setOptionFormOpen(false)}>
              Cancel
            </Button>
          </div>
        }
      >
        <form id="option-form" onSubmit={handleOptionSubmit} className="space-y-4">
          <Input
            label="Option Name"
            placeholder='e.g., Large, Oat Milk, Extra Cheese'
            value={optionForm.name}
            onChange={(e) => setOptionForm({ ...optionForm, name: e.target.value })}
            required
            fullWidth
          />
          <Input
            label="Price Adjustment (₹)"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={optionForm.price_adjustment}
            onChange={(e) =>
              setOptionForm({
                ...optionForm,
                price_adjustment: parseFloat(e.target.value) || 0,
              })
            }
            hint="Extra charge for this option. Use negative value for discount."
            fullWidth
          />
        </form>
      </Modal>
    </div>
  )
}

export default Modifiers