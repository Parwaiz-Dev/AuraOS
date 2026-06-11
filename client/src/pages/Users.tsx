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
import { User, UserRole } from '../types/user'
import { getInitials } from '../lib/utils'
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  KeyIcon,
  MagnifyingGlassIcon,
  UsersIcon,
} from '@heroicons/react/24/outline'

const ROLE_BADGE: Record<UserRole, { variant: any; label: string }> = {
  ADMIN:     { variant: 'error',   label: 'Admin' },
  WAITER:    { variant: 'info',    label: 'Waiter' },
  KITCHEN:   { variant: 'warning', label: 'Kitchen' },
  RECEPTION: { variant: 'success', label: 'Reception' },
}

interface FormData {
  email: string
  password: string
  name: string
  role: UserRole
  is_active: boolean
}

const defaultForm: FormData = {
  email: '', password: '', name: '', role: 'WAITER', is_active: true,
}

const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [form, setForm] = useState<FormData>(defaultForm)
  const [saving, setSaving] = useState(false)
  const [pwdOpen, setPwdOpen] = useState(false)
  const [pwdUserId, setPwdUserId] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [savingPwd, setSavingPwd] = useState(false)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | 'ALL'>('ALL')

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users')
      setUsers(res.data.data || [])
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUsers() }, [])

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const matchRole = roleFilter === 'ALL' || u.role === roleFilter
      const matchSearch =
        !search ||
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())
      return matchRole && matchSearch
    })
  }, [users, search, roleFilter])

  const openCreate = () => {
    setEditing(null)
    setForm(defaultForm)
    setFormOpen(true)
  }

  const openEdit = (user: User) => {
    setEditing(user)
    setForm({
      email: user.email,
      password: '',
      name: user.name,
      role: user.role,
      is_active: (user as any).is_active ?? true,
    })
    setFormOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Name is required'); return }
    if (!form.email.trim()) { toast.error('Email is required'); return }
    if (!editing && !form.password.trim()) { toast.error('Password is required'); return }
    setSaving(true)
    try {
      if (editing) {
        const res = await api.put(`/users/${editing.id}`, {
          name: form.name,
          email: form.email,
          role: form.role,
          is_active: form.is_active,
        })
        setUsers((p) => p.map((u) => (u.id === editing.id ? res.data.data : u)))
        toast.success('User updated')
      } else {
        const res = await api.post('/users', form)
        setUsers((p) => [res.data.data, ...p])
        toast.success('User created')
      }
      setFormOpen(false)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this user permanently?')) return
    try {
      await api.delete(`/users/${id}`)
      setUsers((p) => p.filter((u) => u.id !== id))
      toast.success('User deleted')
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const handlePasswordReset = async () => {
    if (newPwd.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    setSavingPwd(true)
    try {
      await api.patch(`/users/${pwdUserId}/password`, { newPassword: newPwd })
      toast.success('Password updated')
      setPwdOpen(false)
      setNewPwd('')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSavingPwd(false)
    }
  }

  if (loading) return <Loading text="Loading users…" />

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500 mt-0.5">{users.length} team member{users.length !== 1 ? 's' : ''}</p>
        </div>
        <Button
          variant="primary"
          leftIcon={<PlusIcon className="w-4 h-4" />}
          onClick={openCreate}
        >
          Add User
        </Button>
      </div>

      {/* Filters */}
      <Card padding="sm">
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<MagnifyingGlassIcon className="w-4 h-4" />}
            fullWidth
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            className="form-select min-w-[130px]"
          >
            <option value="ALL">All Roles</option>
            <option value="ADMIN">Admin</option>
            <option value="WAITER">Waiter</option>
            <option value="KITCHEN">Kitchen</option>
            <option value="RECEPTION">Reception</option>
          </select>
        </div>
      </Card>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<UsersIcon className="w-7 h-7" />}
            title="No users found"
            description="Add team members to get started."
            action={{ label: 'Add User', onClick: openCreate }}
          />
        </Card>
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => {
                  const badge = ROLE_BADGE[user.role]
                  return (
                    <tr key={user.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                            <span className="text-indigo-700 font-semibold text-xs">
                              {getInitials(user.name)}
                            </span>
                          </div>
                          <span className="font-medium text-gray-900">{user.name}</span>
                        </div>
                      </td>
                      <td className="text-gray-500">{user.email}</td>
                      <td>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </td>
                      <td>
                        <Badge variant={(user as any).is_active !== false ? 'success' : 'default'}>
                          {(user as any).is_active !== false ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEdit(user)}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { setPwdUserId(user.id); setNewPwd(''); setPwdOpen(true) }}
                            className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Reset password"
                          >
                            <KeyIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(user.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit User' : 'Add New User'}
        size="sm"
        footer={
          <div className="flex gap-3">
            <Button type="submit" form="user-form" variant="primary" fullWidth isLoading={saving}>
              {editing ? 'Save Changes' : 'Create User'}
            </Button>
            <Button variant="outline" fullWidth onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
          </div>
        }
      >
        <form id="user-form" onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Full Name"
            placeholder="John Doe"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            fullWidth
          />
          <Input
            label="Email"
            type="email"
            placeholder="john@restaurant.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
            fullWidth
          />
          {!editing && (
            <Input
              label="Password"
              type="password"
              placeholder="Min 8 characters"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              fullWidth
            />
          )}
          <div>
            <label className="form-label">Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
              className="form-select w-full"
            >
              <option value="ADMIN">Admin</option>
              <option value="WAITER">Waiter</option>
              <option value="KITCHEN">Kitchen</option>
              <option value="RECEPTION">Reception</option>
            </select>
          </div>
          {editing && (
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="is_active"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded"
              />
              <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                Active account
              </label>
            </div>
          )}
        </form>
      </Modal>

      {/* Password Reset Modal */}
      <Modal
        isOpen={pwdOpen}
        onClose={() => setPwdOpen(false)}
        title="Reset Password"
        size="sm"
        footer={
          <div className="flex gap-3">
            <Button variant="primary" fullWidth onClick={handlePasswordReset} isLoading={savingPwd}>
              Update Password
            </Button>
            <Button variant="outline" fullWidth onClick={() => setPwdOpen(false)}>
              Cancel
            </Button>
          </div>
        }
      >
        <Input
          label="New Password"
          type="password"
          placeholder="Min 8 characters"
          value={newPwd}
          onChange={(e) => setNewPwd(e.target.value)}
          fullWidth
        />
      </Modal>
    </div>
  )
}

export default Users
