import React, { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import api, { getErrorMessage } from '../api';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import {
  PlusIcon,
  TrashIcon,
  BuildingStorefrontIcon,
  ArrowTrendingUpIcon,
  CurrencyDollarIcon,
  ShoppingCartIcon,
} from '@heroicons/react/24/outline';

// ── Types ──────────────────────────────────────────────────────────────────────

interface RestaurantInfo {
  id: string;
  name: string;
  slug: string;
  restaurant_type: string;
}

interface OutletDetail {
  id: string;
  name: string;
  slug: string;
  restaurant_type: string;
  added_at: string;
}

interface OrganizationGroup {
  id: string;
  name: string;
  owner_user_id: string;
  created_at: string;
  updated_at: string;
  restaurants?: OutletDetail[];
}

interface OutletMetric {
  id: string;
  name: string;
  slug: string;
  revenue: number;
  orders: number;
}

interface AggregateMetrics {
  total_revenue: number;
  total_orders: number;
  active_outlets: number;
  outlets: OutletMetric[];
}

// ── Main Component ─────────────────────────────────────────────────────────────

const MultiOutlet: React.FC = () => {
  const { user } = useAuth();

  // Guard: super admin only
  if (user && !user.isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const [groups, setGroups] = useState<OrganizationGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<OrganizationGroup | null>(null);
  const [metrics, setMetrics] = useState<AggregateMetrics | null>(null);
  const [allRestaurants, setAllRestaurants] = useState<RestaurantInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [metricsLoading, setMetricsLoading] = useState(false);

  // Create group
  const [showCreate, setShowCreate] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [creating, setCreating] = useState(false);

  // Add restaurant
  const [showAddRestaurant, setShowAddRestaurant] = useState(false);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('');
  const [adding, setAdding] = useState(false);

  // Fetch groups
  const fetchGroups = useCallback(async () => {
    try {
      const res = await api.get('/organizations/groups');
      setGroups(res.data.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch all restaurants for picker
  const fetchRestaurants = useCallback(async () => {
    try {
      const res = await api.get('/organizations/restaurants');
      setAllRestaurants(res.data.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    fetchGroups();
    fetchRestaurants();
  }, [fetchGroups, fetchRestaurants]);

  // Select group & load details + metrics
  const selectGroup = async (group: OrganizationGroup) => {
    try {
      const detailRes = await api.get(`/organizations/groups/${group.id}`);
      const groupDetail = detailRes.data.data as OrganizationGroup;
      setSelectedGroup(groupDetail);

      setMetricsLoading(true);
      const metricsRes = await api.get(`/organizations/groups/${group.id}/metrics`);
      setMetrics(metricsRes.data.data as AggregateMetrics);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setMetricsLoading(false);
    }
  };

  // Create group
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    setCreating(true);
    try {
      await api.post('/organizations/groups', { name: newGroupName.trim() });
      setNewGroupName('');
      setShowCreate(false);
      fetchGroups();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  // Delete group
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete organization "${name}"? All restaurant links will be removed.`)) return;
    try {
      await api.delete(`/organizations/groups/${id}`);
      if (selectedGroup?.id === id) setSelectedGroup(null);
      fetchGroups();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  // Add restaurant to group
  const handleAddRestaurant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRestaurantId || !selectedGroup) return;
    setAdding(true);
    try {
      await api.post(`/organizations/groups/${selectedGroup.id}/restaurants`, {
        restaurant_id: selectedRestaurantId,
      });
      setSelectedRestaurantId('');
      setShowAddRestaurant(false);
      selectGroup(selectedGroup);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setAdding(false);
    }
  };

  // Remove restaurant from group
  const handleRemoveRestaurant = async (restaurantId: string, restaurantName: string) => {
    if (!selectedGroup) return;
    if (!confirm(`Remove "${restaurantName}" from this group?`)) return;
    try {
      await api.delete(`/organizations/groups/${selectedGroup.id}/restaurants/${restaurantId}`);
      selectGroup(selectedGroup);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  if (loading) {
    return (
      <div className="animate-fade-in p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Multi Outlet</h1>
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Multi Outlet</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage organization groups and view aggregate metrics across outlets
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <PlusIcon className="w-4 h-4 mr-1.5" />
          Create Group
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Group List */}
        <div className="lg:col-span-1">
          <Card padding="none">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wider">
                Organization Groups
              </h2>
            </div>
            {groups.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-sm">
                No groups yet. Create one to get started.
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {groups.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => selectGroup(g)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-center justify-between ${
                      selectedGroup?.id === g.id ? 'bg-brand-50 border-l-2 border-brand-500' : ''
                    }`}
                  >
                    <span className="font-medium text-gray-800 text-sm">{g.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(g.id, g.name);
                      }}
                      className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                      title="Delete group"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right: Detail */}
        <div className="lg:col-span-2 space-y-6">
          {!selectedGroup ? (
            <Card>
              <div className="text-center py-12 text-gray-400">
                <BuildingStorefrontIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>Select an organization group to view details</p>
              </div>
            </Card>
          ) : (
            <>
              {/* Aggregate Metrics */}
              {metricsLoading ? (
                <Card>
                  <div className="text-gray-500 text-sm">Loading metrics...</div>
                </Card>
              ) : metrics ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Card hover className="flex items-center gap-4">
                    <div className="p-3 bg-emerald-50 rounded-lg">
                      <CurrencyDollarIcon className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 uppercase">Total Revenue</div>
                      <div className="text-xl font-bold text-gray-900">
                        ₹{metrics.total_revenue.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </Card>
                  <Card hover className="flex items-center gap-4">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <ShoppingCartIcon className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 uppercase">Total Orders</div>
                      <div className="text-xl font-bold text-gray-900">
                        {metrics.total_orders.toLocaleString()}
                      </div>
                    </div>
                  </Card>
                  <Card hover className="flex items-center gap-4">
                    <div className="p-3 bg-purple-50 rounded-lg">
                      <ArrowTrendingUpIcon className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 uppercase">Active Outlets</div>
                      <div className="text-xl font-bold text-gray-900">
                        {metrics.active_outlets}
                      </div>
                    </div>
                  </Card>
                </div>
              ) : null}

              {/* Outlets */}
              <Card padding="none">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wider">
                    Outlets ({selectedGroup.restaurants?.length || 0})
                  </h2>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setShowAddRestaurant(true);
                      setSelectedRestaurantId('');
                    }}
                  >
                    <PlusIcon className="w-4 h-4 mr-1" />
                    Add Outlet
                  </Button>
                </div>
                {(selectedGroup.restaurants?.length || 0) === 0 ? (
                  <div className="p-6 text-center text-gray-400 text-sm">
                    No restaurants in this group. Add one to see metrics.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Restaurant</th>
                          <th>Type</th>
                          <th>Slug</th>
                          <th className="text-right">Revenue</th>
                          <th className="text-right">Orders</th>
                          <th className="w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedGroup.restaurants?.map((r) => {
                          const outletMetric = metrics?.outlets.find((o) => o.id === r.id);
                          return (
                            <tr key={r.id}>
                              <td>
                                <div className="flex items-center gap-2">
                                  <BuildingStorefrontIcon className="w-4 h-4 text-gray-400" />
                                  <span className="font-medium text-gray-900">{r.name}</span>
                                </div>
                              </td>
                              <td>
                                <Badge variant="default">{r.restaurant_type}</Badge>
                              </td>
                              <td className="text-gray-500 font-mono text-xs">{r.slug}</td>
                              <td className="text-right font-medium">
                                ₹{(outletMetric?.revenue || 0).toLocaleString('en-IN')}
                              </td>
                              <td className="text-right text-gray-600">
                                {outletMetric?.orders || 0}
                              </td>
                              <td>
                                <button
                                  onClick={() => handleRemoveRestaurant(r.id, r.name)}
                                  className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                                  title="Remove from group"
                                >
                                  <TrashIcon className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      </div>

      {/* Create Group Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Organization Group" size="sm">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Group Name"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="e.g., Delhi Outlets"
            required
            autoFocus
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={creating} disabled={!newGroupName.trim()}>
              Create
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Restaurant Modal */}
      <Modal
        isOpen={showAddRestaurant}
        onClose={() => setShowAddRestaurant(false)}
        title="Add Restaurant to Group"
        size="sm"
      >
        <form onSubmit={handleAddRestaurant} className="space-y-4">
          <div>
            <label className="form-label">Restaurant</label>
            <select
              value={selectedRestaurantId}
              onChange={(e) => setSelectedRestaurantId(e.target.value)}
              className="form-select w-full"
              required
            >
              <option value="">Select a restaurant...</option>
              {allRestaurants
                .filter((r) => !selectedGroup?.restaurants?.find((gr) => gr.id === r.id))
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.slug})
                  </option>
                ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowAddRestaurant(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={adding} disabled={!selectedRestaurantId}>
              Add
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default MultiOutlet;