import crypto from 'crypto';
import { ordersRepository } from './orders.repository';
import { tablesRepository } from '@/modules/tables/tables.repository';
import { menuRepository } from '@/modules/menu/menu.repository';
import { paymentsRepository } from '@/modules/payments/payments.repository';
import { inventoryRepository } from '@/modules/inventory/inventory.repository';
import { restaurantsRepository } from '@/modules/restaurants/restaurants.repository';
import {
  Order,
  OrderItem,
  OrderStats,
  EnrichedOrder,
  UpdatedOrderItem,
  CreateOrderRequest,
  UpdateOrderRequest,
  OrderItemRequest,
} from './orders.types';
import { BadRequestError, NotFoundError } from '@/shared/errors/AppError';

export class OrdersService {
  private computePriorityScore(orderType: string, orderSource: string): number {
    const typeScore = {
      DINE_IN: 30,
      PARCEL: 20,
      ONLINE: 10,
    } as Record<string, number>;

    const sourceScore = {
      WAITER: 30,
      RECEPTION: 25,
      QR: 10,
      WHATSAPP: 15,
      ZOMATO: 15,
    } as Record<string, number>;

    return (typeScore[orderType] ?? 0) + (sourceScore[orderSource] ?? 0);
  }

  private generateOrderNumber(restaurantId: string): string {
    const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
    const suffix = crypto.randomBytes(3).toString('hex');
    return `ORD-${restaurantId.slice(0, 8)}-${timestamp}-${suffix}`;
  }

  async createOrder(restaurantId: string, createdBy: string | null, payload: CreateOrderRequest): Promise<{ order: Order; items: OrderItem[] }> {
    const { table_id, order_type, order_source, special_instructions, items } = payload;

    if (order_type === 'DINE_IN' && !table_id) {
      throw new BadRequestError('Table ID is required for dine-in orders');
    }

    if (table_id) {
      const table = await tablesRepository.findById(table_id);
      if (!table || table.restaurant_id !== restaurantId) {
        throw new BadRequestError('Table does not belong to this restaurant');
      }
    }

    if (!items.length) {
      throw new BadRequestError('Order must include at least one item');
    }

    const groupedItems = this.groupOrderItems(items);
    const orderItems = await Promise.all(groupedItems.map(async (item) => this.buildOrderItem(restaurantId, item)));

    const totalAmount = orderItems.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
    const priorityScore = this.computePriorityScore(order_type, order_source);
    const orderNumber = this.generateOrderNumber(restaurantId);

    const staffSources = ['WAITER', 'RECEPTION'];
    const initialStatus = staffSources.includes(order_source) ? 'ACCEPTED' : 'CREATED';

    // Generate token number if QSR mode is enabled for this restaurant
    let tokenNumber: string | null = null;
    const restaurant = await restaurantsRepository.findById(restaurantId);
    if (restaurant?.qsr_enabled) {
      const counter = await restaurantsRepository.nextTokenNumber(restaurantId);
      const seq = String(counter).padStart(3, '0');
      tokenNumber = `${restaurant.token_prefix}-${seq}`;
    }

    return ordersRepository.createOrderWithItems(
      restaurantId,
      table_id ?? null,
      orderNumber,
      order_type,
      order_source,
      totalAmount,
      priorityScore,
      special_instructions ?? null,
      createdBy,
      orderItems,
      initialStatus,
      tokenNumber,
    );
  }

  private async buildOrderItem(restaurantId: string, item: OrderItemRequest) {
    const menuItem = await menuRepository.findMenuItemById(item.menu_item_id);
    if (!menuItem || menuItem.restaurant_id !== restaurantId) {
      throw new BadRequestError('Menu item does not belong to this restaurant');
    }

    return {
      menu_item_id: item.menu_item_id,
      quantity: item.quantity,
      unit_price: menuItem.price,
      special_instructions: item.special_instructions ?? null,
      status: 'PENDING',
    };
  }

  async getOrder(orderId: string, restaurantId: string): Promise<{ order: EnrichedOrder; items: OrderItem[] }> {
    const detailed = await ordersRepository.findByIdWithDetails(orderId);
    if (!detailed || detailed.restaurant_id !== restaurantId) {
      throw new NotFoundError('Order not found');
    }

    // Return the enriched order (with table + items embedded) and the items array
    return { order: detailed, items: detailed.order_items };
  }

  /**
   * Find the active (open) order for a table, if any.
   * Used by the frontend to offer "add to existing order" instead of creating a new one.
   */
  async getActiveOrderForTable(restaurantId: string, tableId: string): Promise<{ order: Order; items: OrderItem[] } | null> {
    const order = await ordersRepository.findActiveByTableId(restaurantId, tableId);
    if (!order) return null;
    const items = await ordersRepository.findItemsByOrderId(order.id);
    return { order, items };
  }

  /**
   * Append items to an existing order (running tab).
   * The order must be open (not COMPLETED / CANCELLED).
   */
  async addItemsToOrder(orderId: string, restaurantId: string, items: OrderItemRequest[]): Promise<{ order: Order; items: OrderItem[] }> {
    const order = await ordersRepository.findById(orderId);
    if (!order || order.restaurant_id !== restaurantId) {
      throw new NotFoundError('Order not found');
    }

    if (['COMPLETED', 'CANCELLED'].includes(order.status)) {
      throw new BadRequestError('Cannot add items to a completed or cancelled order');
    }

    if (!items.length) {
      throw new BadRequestError('At least one item is required');
    }

    const grouped = this.groupOrderItems(items);
    const orderItems = await Promise.all(grouped.map((item) => this.buildOrderItem(restaurantId, item)));

    return ordersRepository.addItemsToOrder(orderId, restaurantId, orderItems);
  }

  private groupOrderItems(items: CreateOrderRequest['items']): CreateOrderRequest['items'] {
    const grouped = new Map<string, CreateOrderRequest['items'][number]>; 

    for (const item of items) {
      const key = `${item.menu_item_id}::${item.special_instructions ?? ''}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        grouped.set(key, { ...item });
      }
    }

    return Array.from(grouped.values());
  }

  async getOrders(
    restaurantId: string,
    limit: number = 50,
    offset: number = 0,
    statusFilter?: string,
    sortBy?: string,
    sortOrder?: string,
  ): Promise<{ items: any[]; total: number }> {
    const [items, total] = await Promise.all([
      ordersRepository.findByRestaurantIdFiltered(restaurantId, limit, offset, statusFilter, sortBy, sortOrder),
      ordersRepository.countByRestaurantId(restaurantId, statusFilter),
    ]);
    return { items, total };
  }

  async updateOrder(orderId: string, restaurantId: string, payload: UpdateOrderRequest): Promise<Order> {
    const order = await ordersRepository.findById(orderId);
    if (!order || order.restaurant_id !== restaurantId) {
      throw new NotFoundError('Order not found');
    }

    const updates: any = {};
    if (payload.status !== undefined) {
      this.validateStatusTransition(order.status, payload.status);
      updates.status = payload.status;
      if (payload.status === 'COMPLETED') {
        updates.completed_at = new Date();
      }
      if (payload.status === 'CANCELLED') {
        updates.completed_at = new Date();
      }
    }

    if (payload.special_instructions !== undefined) {
      updates.special_instructions = payload.special_instructions ?? null;
    }

    const updated = await ordersRepository.update(orderId, updates);
    if (!updated) {
      throw new NotFoundError('Order not found');
    }

    // When an order is marked COMPLETED, auto-create a CASH payment for any
    // remaining unpaid balance — but ONLY if there are no PENDING payments
    // already in-flight (e.g. a Razorpay online payment waiting for webhook
    // confirmation). Creating a phantom CASH record while an online payment
    // is pending would leave the order double-paid once the webhook arrives.
    if (payload.status === 'COMPLETED') {
      const orderTotal = Number(order.total_amount || 0);
      if (orderTotal > 0) {
        const existingPayments = await paymentsRepository.findByOrderId(orderId);

        const hasPendingPayment = existingPayments.some((p) => p.status === 'PENDING');

        if (!hasPendingPayment) {
          const alreadyPaid = existingPayments
            .filter((p) => p.status === 'PAID')
            .reduce((s, p) => s + Number(p.amount), 0);
          const balance = orderTotal - alreadyPaid;

          if (balance > 0.01) {
            // Auto-record the remaining balance as CASH PAID
            const invoiceSeq = Date.now().toString().slice(-6);
            await paymentsRepository.createPayment(
              restaurantId,
              orderId,
              balance,
              'CASH',
              'PAID',
              `AUTO-${invoiceSeq}`,
            );
          }
        }
      }
    }

    return updated;
  }

  private validateStatusTransition(currentStatus: string, requestedStatus: string): void {
    const transitions: Record<string, string[]> = {
      CREATED: ['ACCEPTED', 'CANCELLED'],
      ACCEPTED: ['PREPARING', 'CANCELLED'],
      PREPARING: ['READY', 'CANCELLED'],
      READY: ['OUT_FOR_DELIVERY', 'COMPLETED', 'CANCELLED'],
      OUT_FOR_DELIVERY: ['COMPLETED', 'CANCELLED'],
      COMPLETED: [],
      CANCELLED: [],
    };

    if (!transitions[currentStatus]?.includes(requestedStatus)) {
      throw new BadRequestError(`Invalid status transition from ${currentStatus} to ${requestedStatus}`);
    }
  }

  async deleteOrder(orderId: string, restaurantId: string): Promise<void> {
    const order = await ordersRepository.findById(orderId);
    if (!order || order.restaurant_id !== restaurantId) {
      throw new NotFoundError('Order not found');
    }

    const deleted = await ordersRepository.delete(orderId);
    if (!deleted) {
      throw new NotFoundError('Order not found');
    }
  }

  async getOrderStats(restaurantId: string): Promise<OrderStats> {
    return ordersRepository.getStats(restaurantId);
  }

  /**
   * Update the status of a single order item (PENDING → PREPARING → DONE).
   *
   * When all items in an order are marked DONE, the order is automatically
   * advanced to READY so the waiter knows to serve the food.
   *
   * Returns the updated item and a flag indicating if the order was auto-advanced.
   */
  async updateItemStatus(
    orderId: string,
    itemId: string,
    restaurantId: string,
    status: 'PENDING' | 'PREPARING' | 'DONE',
  ): Promise<{ item: UpdatedOrderItem; orderAutoAdvanced: boolean; order?: Order }> {
    // Verify order belongs to this restaurant
    const order = await ordersRepository.findById(orderId);
    if (!order || order.restaurant_id !== restaurantId) {
      throw new NotFoundError('Order not found');
    }

    if (['COMPLETED', 'CANCELLED'].includes(order.status)) {
      throw new BadRequestError('Cannot update items on a completed or cancelled order');
    }

    const item = await ordersRepository.updateItemStatus(itemId, orderId, status);
    if (!item) {
      throw new NotFoundError('Order item not found');
    }

    // Decrement inventory when item is marked DONE — non-fatal if tracking not set up
    if (status === 'DONE') {
      try {
        const orderItem = await ordersRepository.findItemsByOrderId(orderId);
        const thisItem = orderItem.find((i) => i.id === itemId);
        if (thisItem) {
          await inventoryRepository.decrementStockForMenuItem(
            restaurantId,
            thisItem.menu_item_id,
            thisItem.quantity,
          );
        }
      } catch (err) {
        console.error('[Inventory] Failed to decrement stock for item', itemId, err);
      }
    }

    // If all items are now DONE and the order is still PREPARING,
    // auto-advance to READY so the waiter gets notified
    let orderAutoAdvanced = false;
    let updatedOrder: Order | undefined;

    if (status === 'DONE' && order.status === 'PREPARING') {
      const allDone = await ordersRepository.allItemsDone(orderId);
      if (allDone) {
        updatedOrder = await ordersRepository.update(orderId, { status: 'READY' }) ?? undefined;
        orderAutoAdvanced = true;
      }
    }

    return { item, orderAutoAdvanced, order: updatedOrder };
  }
}

export const ordersService = new OrdersService();