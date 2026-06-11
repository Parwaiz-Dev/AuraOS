import { tablesRepository } from './tables.repository';
import {
  Table,
  TableStats,
  CreateTableRequest,
  UpdateTableRequest,
} from './tables.types';
import { ConflictError, NotFoundError, BadRequestError } from '@/shared/errors/AppError';

export class TablesService {
  /**
   * Validate table number format
   */
  validateTableNumber(tableNumber: string): string {
    const trimmed = tableNumber.trim();
    if (!trimmed) {
      throw new BadRequestError('Table number cannot be empty');
    }
    if (trimmed.length > 50) {
      throw new BadRequestError('Table number must be less than 50 characters');
    }
    // Allow alphanumeric, spaces, hyphens, underscores
    if (!/^[a-zA-Z0-9\s\-_]+$/.test(trimmed)) {
      throw new BadRequestError('Table number can only contain letters, numbers, spaces, hyphens, and underscores');
    }
    return trimmed;
  }

  /**
   * Create a new table
   */
  async createTable(restaurantId: string, payload: CreateTableRequest): Promise<Table> {
    const { table_number, seats } = payload;

    // Validate table number
    const validatedTableNumber = this.validateTableNumber(table_number);

    // Check if table number already exists
    const exists = await tablesRepository.tableNumberExists(restaurantId, validatedTableNumber);
    if (exists) {
      throw new ConflictError('Table number already exists for this restaurant');
    }

    return tablesRepository.create(restaurantId, validatedTableNumber, seats);
  }

  /**
   * Get table by ID
   */
  async getTable(tableId: string): Promise<Table> {
    const table = await tablesRepository.findById(tableId);
    if (!table) {
      throw new NotFoundError('Table not found');
    }
    return table;
  }

  /**
   * Get all tables for restaurant
   */
  async getAllTables(restaurantId: string, limit: number = 50, offset: number = 0): Promise<Table[]> {
    return tablesRepository.findByRestaurantId(restaurantId, limit, offset);
  }

  /**
   * Get all tables enriched with their current active order (occupancy view).
   * Used by the Tables command-center screen for waiters / reception.
   */
  async getTablesWithStatus(restaurantId: string): Promise<any[]> {
    return tablesRepository.findAllWithOrderStatus(restaurantId);
  }

  /**
   * Update table
   */
  async updateTable(tableId: string, restaurantId: string, payload: UpdateTableRequest): Promise<Table> {
    const { table_number, seats, is_active } = payload;

    // Verify table exists and belongs to restaurant
    const existing = await this.getTable(tableId);
    if (existing.restaurant_id !== restaurantId) {
      throw new NotFoundError('Table not found');
    }

    const updates: any = {};

    if (table_number !== undefined) {
      const validatedTableNumber = this.validateTableNumber(table_number);
      // Check if new table number conflicts (only if it's different)
      if (validatedTableNumber !== existing.table_number) {
        const exists = await tablesRepository.tableNumberExists(restaurantId, validatedTableNumber, tableId);
        if (exists) {
          throw new ConflictError('Table number already exists for this restaurant');
        }
        updates.table_number = validatedTableNumber;
      }
    }

    if (seats !== undefined) {
      updates.seats = seats;
    }

    if (is_active !== undefined) {
      updates.is_active = is_active;
    }

    const updated = await tablesRepository.update(tableId, updates);
    if (!updated) {
      throw new NotFoundError('Table not found');
    }

    return updated;
  }

  /**
   * Delete table
   */
  async deleteTable(tableId: string, restaurantId: string): Promise<void> {
    // Verify table exists and belongs to restaurant
    const table = await this.getTable(tableId);
    if (table.restaurant_id !== restaurantId) {
      throw new NotFoundError('Table not found');
    }

    const deleted = await tablesRepository.delete(tableId);
    if (!deleted) {
      throw new NotFoundError('Table not found');
    }
  }

  /**
   * Get table statistics
   */
  async getTableStats(restaurantId: string): Promise<TableStats> {
    return tablesRepository.getStats(restaurantId);
  }

  /**
   * Get table count for restaurant
   */
  async getTableCount(restaurantId: string): Promise<number> {
    return tablesRepository.count(restaurantId);
  }
}

export const tablesService = new TablesService();