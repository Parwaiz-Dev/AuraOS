import { menuRepository } from '@/modules/menu/menu.repository';
import { inventoryRepository } from './inventory.repository';
import { BadRequestError, ConflictError, NotFoundError } from '@/shared/errors/AppError';
import {
  CreateInventoryItemRequest,
  InventoryItem,
  UpdateInventoryItemRequest,
  InventoryStats,
  InventoryTransaction,
  TransactionType,
} from './inventory.types';

export class InventoryService {
  async createInventoryItem(
    restaurantId: string,
    payload: CreateInventoryItemRequest,
    createdBy?: string | null,
  ): Promise<InventoryItem> {
    const { menu_item_id, current_stock, reorder_level } = payload;

    const menuItem = await menuRepository.findMenuItemById(menu_item_id);
    if (!menuItem || menuItem.restaurant_id !== restaurantId) {
      throw new BadRequestError('Menu item does not belong to this restaurant');
    }

    const existing = await inventoryRepository.findByMenuItemId(menu_item_id);
    if (existing && existing.restaurant_id === restaurantId) {
      throw new ConflictError('Inventory item already exists for this menu item');
    }

    const item = await inventoryRepository.create(restaurantId, menu_item_id, current_stock, reorder_level);

    // Log the initial stock entry
    if (current_stock > 0) {
      await inventoryRepository.logTransaction(
        restaurantId,
        item.id,
        menu_item_id,
        0,
        current_stock,
        'INITIAL',
        'Initial stock entry',
        createdBy ?? null,
      );
    }

    return item;
  }

  async getInventoryItem(itemId: string, restaurantId: string): Promise<InventoryItem> {
    const item = await inventoryRepository.findById(itemId);
    if (!item || item.restaurant_id !== restaurantId) {
      throw new NotFoundError('Inventory item not found');
    }
    return item;
  }

  async getInventoryItems(restaurantId: string, limit = 50, offset = 0): Promise<InventoryItem[]> {
    return inventoryRepository.findByRestaurantId(restaurantId, limit, offset);
  }

  async updateInventoryItem(
    itemId: string,
    restaurantId: string,
    payload: UpdateInventoryItemRequest,
    changedBy?: string | null,
    notes?: string | null,
  ): Promise<InventoryItem> {
    const item = await inventoryRepository.findById(itemId);
    if (!item || item.restaurant_id !== restaurantId) {
      throw new NotFoundError('Inventory item not found');
    }

    if (payload.current_stock !== undefined && payload.current_stock < 0) {
      throw new BadRequestError('Current stock cannot be negative');
    }
    if (payload.reorder_level !== undefined && payload.reorder_level < 0) {
      throw new BadRequestError('Reorder level cannot be negative');
    }

    const stockBefore = item.current_stock;

    const updated = await inventoryRepository.update(itemId, {
      current_stock: payload.current_stock,
      reorder_level: payload.reorder_level,
    });

    if (!updated) {
      throw new NotFoundError('Inventory item update failed');
    }

    // Log the stock change if stock level changed
    if (payload.current_stock !== undefined && payload.current_stock !== stockBefore) {
      const stockAfter = payload.current_stock;
      const change = stockAfter - stockBefore;

      // Determine transaction type from the direction of change
      let txType: TransactionType = 'ADJUSTMENT';
      if (change > 0) txType = 'RESTOCK';
      else if (change < 0) txType = 'USAGE';

      await inventoryRepository.logTransaction(
        restaurantId,
        itemId,
        item.menu_item_id,
        stockBefore,
        stockAfter,
        txType,
        notes ?? null,
        changedBy ?? null,
      );
    }

    return updated;
  }

  async deleteInventoryItem(itemId: string, restaurantId: string): Promise<void> {
    const item = await inventoryRepository.findById(itemId);
    if (!item || item.restaurant_id !== restaurantId) {
      throw new NotFoundError('Inventory item not found');
    }

    const deleted = await inventoryRepository.delete(itemId);
    if (!deleted) {
      throw new NotFoundError('Inventory item not found');
    }
  }

  async getInventoryStats(restaurantId: string): Promise<InventoryStats> {
    return inventoryRepository.getStats(restaurantId);
  }

  // ── History ───────────────────────────────────────────────────────────────

  async getItemHistory(
    itemId: string,
    restaurantId: string,
    limit = 50,
    offset = 0,
  ): Promise<InventoryTransaction[]> {
    const item = await inventoryRepository.findById(itemId);
    if (!item || item.restaurant_id !== restaurantId) {
      throw new NotFoundError('Inventory item not found');
    }
    return inventoryRepository.getHistory(itemId, limit, offset);
  }

  async getRestaurantHistory(
    restaurantId: string,
    limit = 100,
    offset = 0,
  ): Promise<InventoryTransaction[]> {
    return inventoryRepository.getRestaurantHistory(restaurantId, limit, offset);
  }
}

export const inventoryService = new InventoryService();
