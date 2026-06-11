import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../api';
import { MenuCategory, MenuItem } from '../types/menu';

interface ModifierGroup {
  id: string;
  name: string;
  selection_type: 'single' | 'multiple';
  min_select: number;
  max_select: number;
}

interface MenuFormProps {
  menuItem?: MenuItem; // Optional menu item for editing
  onClose: () => void;
  onSave: (menuItem: MenuItem) => void;
}

const MenuForm: React.FC<MenuFormProps> = ({ menuItem, onClose, onSave }) => {
  const [name, setName] = useState(menuItem?.name || '');
  const [description, setDescription] = useState(menuItem?.description || '');
  const [price, setPrice] = useState(menuItem?.price || 0);
  const [categoryId, setCategoryId] = useState(menuItem?.category_id || '');
  const [prepTime, setPrepTime] = useState(menuItem?.prep_time_minutes || 15);
  const [isVegetarian, setIsVegetarian] = useState(menuItem?.is_vegetarian ?? false);
  const [isActive, setIsActive] = useState(menuItem?.is_active ?? true);
  const [displayOrder, setDisplayOrder] = useState(menuItem?.display_order || 0);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Modifier group attachment state
  const [availableGroups, setAvailableGroups] = useState<ModifierGroup[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingModifiers, setSavingModifiers] = useState(false);

  // Reset form when menuItem changes (create vs edit)
  useEffect(() => {
    if (menuItem) {
      setName(menuItem.name);
      setDescription(menuItem.description || '');
      setPrice(menuItem.price);
      setCategoryId(menuItem.category_id);
      setPrepTime(menuItem.prep_time_minutes);
      setIsVegetarian(menuItem.is_vegetarian);
      setIsActive(menuItem.is_active);
      setDisplayOrder(menuItem.display_order);
    } else {
      setName('');
      setDescription('');
      setPrice(0);
      setCategoryId('');
      setPrepTime(15);
      setIsVegetarian(false);
      setIsActive(true);
      setDisplayOrder(0);
      setSelectedGroupIds(new Set());
    }
  }, [menuItem]);

  // Fetch available modifier groups
  useEffect(() => {
    const fetchModifierGroups = async () => {
      setLoadingGroups(true);
      try {
        const response = await api.get('/modifiers/groups');
        setAvailableGroups(response.data.data || []);
      } catch (error) {
        toast.error('Failed to load modifier groups');
      } finally {
        setLoadingGroups(false);
      }
    };

    fetchModifierGroups();
  }, []);

  // Fetch currently attached modifier groups when editing an existing item
  useEffect(() => {
    if (!menuItem?.id) {
      setSelectedGroupIds(new Set());
      return;
    }

    const fetchAttachedGroups = async () => {
      try {
        const response = await api.get(`/modifiers/menu-items/${menuItem.id}/groups`);
        const groups: { modifier_group_id: string }[] = response.data.data || [];
        setSelectedGroupIds(new Set(groups.map((g) => g.modifier_group_id)));
      } catch (error) {
        toast.error('Failed to load attached modifier groups');
      }
    };

    fetchAttachedGroups();
  }, [menuItem?.id]);

  // Fetch menu categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await api.get('/menus/categories')
        setCategories(response.data.data || [])
      } catch (error) {
        toast.error('Failed to load menu categories')
      }
    }

    fetchCategories();
  }, []);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Name is required.';
    if (price <= 0) newErrors.price = 'Price must be positive.';
    if (!categoryId) newErrors.categoryId = 'Category is required.';
    if (prepTime <= 0) newErrors.prepTime = 'Prep time must be at least 1 minute.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const toggleGroupSelection = (groupId: string) => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const itemData = {
      category_id: categoryId,
      name,
      description,
      price,
      prep_time_minutes: prepTime,
      is_vegetarian: isVegetarian,
      is_active: isActive,
      display_order: displayOrder,
    };

    setSaving(true);
    try {
      const url = menuItem ? `/menus/items/${menuItem.id}` : '/menus/items'
      const response = menuItem
        ? await api.put(url, itemData)
        : await api.post(url, itemData)

      const savedItem: MenuItem = response.data.data;

      // If editing an existing item, update modifier group attachments
      if (menuItem?.id) {
        setSavingModifiers(true);
        try {
          const currentIds = Array.from(selectedGroupIds);

          // Get currently attached groups
          const attachedRes = await api.get(`/modifiers/menu-items/${menuItem.id}/groups`);
          const attached: { modifier_group_id: string }[] = attachedRes.data.data || [];
          const attachedIds = new Set(attached.map((g) => g.modifier_group_id));

          // Detach groups that were removed
          for (const attachedId of attachedIds) {
            if (!currentIds.includes(attachedId)) {
              await api.delete(`/modifiers/menu-items/${menuItem.id}/groups/${attachedId}`);
            }
          }

          // Attach groups that were added
          const toAttach = currentIds.filter((id) => !attachedIds.has(id));
          if (toAttach.length > 0) {
            await api.post(`/modifiers/menu-items/${menuItem.id}/groups`, {
              modifier_group_ids: toAttach,
            });
          }
        } catch (modifierError) {
          toast.error('Failed to update modifier group attachments');
        } finally {
          setSavingModifiers(false);
        }
      }

      onSave(savedItem)
      onClose()
    } catch (error) {
      toast.error('Failed to save menu item')
      setErrors({ api: 'Failed to save menu item. Please try again.' })
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">{menuItem ? 'Edit Menu Item' : 'Create New Menu Item'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            >
              <option value="">Select or create category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            {errors.categoryId && <p className="text-red-500 text-sm mt-1">{errors.categoryId}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            />
            {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Price</label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(parseFloat(e.target.value))}
                min="0"
                step="0.01"
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              />
              {errors.price && <p className="text-red-500 text-sm mt-1">{errors.price}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Prep Time (minutes)</label>
              <input
                type="number"
                value={prepTime}
                onChange={(e) => setPrepTime(parseInt(e.target.value, 10))}
                min="1"
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              />
              {errors.prepTime && <p className="text-red-500 text-sm mt-1">{errors.prepTime}</p>}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isVegetarian"
                checked={isVegetarian}
                onChange={(e) => setIsVegetarian(e.target.checked)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label htmlFor="isVegetarian" className="block text-sm font-medium text-gray-700">Vegetarian</label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label htmlFor="isActive" className="block text-sm font-medium text-gray-700">Active</label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Display Order</label>
            <input
              type="number"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(parseInt(e.target.value, 10))}
              min="0"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            />
          </div>

          {/* Modifier Groups Section */}
          <div className="border-t border-gray-200 pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Modifier Groups
            </label>
            {loadingGroups ? (
              <p className="text-sm text-gray-500">Loading modifier groups...</p>
            ) : availableGroups.length === 0 ? (
              <p className="text-sm text-gray-400 italic">
                No modifier groups available. Create them in{' '}
                <a href="/modifiers" className="text-indigo-600 hover:underline">
                  Settings → Modifiers
                </a>
                .
              </p>
            ) : (
              <div className="space-y-1 max-h-40 overflow-y-auto border border-gray-200 rounded-md p-2">
                {availableGroups.map((group) => {
                  const isSelected = selectedGroupIds.has(group.id);
                  return (
                    <label
                      key={group.id}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm transition-colors ${
                        isSelected
                          ? 'bg-indigo-50 text-indigo-900'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleGroupSelection(group.id)}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <span className="flex-1">{group.name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        group.selection_type === 'single'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {group.selection_type === 'single' ? 'Single' : 'Multiple'}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {errors.api && <p className="text-red-500 text-sm mt-4 text-center">{errors.api}</p>}

          <div className="flex justify-end space-x-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-gray-700 hover:bg-gray-50"
              disabled={savingModifiers}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || savingModifiers}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : savingModifiers ? 'Updating modifiers...' : menuItem ? 'Save Changes' : 'Create Menu Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MenuForm;
