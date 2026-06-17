import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';

/**
 * Socket.io real-time event types
 */
export enum SocketEvent {
  // Order events
  ORDER_CREATED = 'ORDER_CREATED',
  ORDER_UPDATED = 'ORDER_UPDATED',
  ORDER_DELETED = 'ORDER_DELETED',
  ORDER_COMPLETED = 'ORDER_COMPLETED',
  ORDER_CANCELLED = 'ORDER_CANCELLED',
  ORDER_DELAYED = 'ORDER_DELAYED',   // fired by background job when order exceeds threshold

  // Reservation events
  RESERVATION_CREATED = 'RESERVATION_CREATED',

  // Payment events
  PAYMENT_CREATED = 'PAYMENT_CREATED',
  PAYMENT_UPDATED = 'PAYMENT_UPDATED',
  PAYMENT_COMPLETED = 'PAYMENT_COMPLETED',

  // Inventory events
  INVENTORY_LOW_STOCK = 'INVENTORY_LOW_STOCK',
  INVENTORY_UPDATED = 'INVENTORY_UPDATED',

  // Table events
  TABLE_OCCUPIED = 'TABLE_OCCUPIED',
  TABLE_FREED = 'TABLE_FREED',
  TABLE_CREATED = 'TABLE_CREATED',
  TABLE_UPDATED = 'TABLE_UPDATED',
  TABLE_DELETED = 'TABLE_DELETED',

  // Error events
  ERROR = 'ERROR',
}

export interface OrderEventPayload {
  order_id: string;
  restaurant_id: string;
  status: string;
  total_amount?: number;
  table_id?: string | null;
  order_number?: string; // when set, update is also pushed to the public order room
}

export interface DelayedOrderPayload {
  order_id: string;
  restaurant_id: string;
  order_number: string;
  status: string;
  minutes_elapsed: number;
  threshold_minutes: number;
  table_number?: string | null;
}

export interface PaymentEventPayload {
  payment_id: string;
  restaurant_id: string;
  order_id: string;
  status: string;
  amount: number;
}

export interface ReservationEventPayload {
  reservation_id: string;
  restaurant_id: string;
  status: string;
}

export interface InventoryEventPayload {
  inventory_item_id: string;
  restaurant_id: string;
  menu_item_id: string;
  current_stock: number;
  reorder_level: number;
}

export interface TableEventPayload {
  table_id: string;
  restaurant_id: string;
  table_number: string;
  status: 'occupied' | 'freed';
}

/**
 * Real-time event broadcaster
 */
export class EventBroadcaster {
  private io: SocketIOServer;

  constructor(io: SocketIOServer) {
    this.io = io;
  }

  /**
   * Broadcast order created event to restaurant room
   */
  broadcastOrderCreated(payload: OrderEventPayload): void {
    this.io.to(`restaurant:${payload.restaurant_id}`).emit(SocketEvent.ORDER_CREATED, payload);
  }

  /**
   * Broadcast order status update to restaurant room (and the public order room
   * when order_number is provided, so the customer's tracking page updates live).
   */
  broadcastOrderUpdated(payload: OrderEventPayload): void {
    this.io.to(`restaurant:${payload.restaurant_id}`).emit(SocketEvent.ORDER_UPDATED, payload);
    if (payload.order_number) {
      this.io.to(`order:${payload.order_number}`).emit(SocketEvent.ORDER_UPDATED, payload);
    }
  }

  /**
   * Broadcast order deleted event to restaurant room
   */
  broadcastOrderDeleted(payload: OrderEventPayload): void {
    this.io.to(`restaurant:${payload.restaurant_id}`).emit(SocketEvent.ORDER_DELETED, payload);
  }

  /**
   * Broadcast order completed event to restaurant room (+ public order room)
   */
  broadcastOrderCompleted(payload: OrderEventPayload): void {
    this.io.to(`restaurant:${payload.restaurant_id}`).emit(SocketEvent.ORDER_COMPLETED, payload);
    if (payload.order_number) {
      this.io.to(`order:${payload.order_number}`).emit(SocketEvent.ORDER_COMPLETED, payload);
    }
  }

  /**
   * Broadcast order cancelled event to restaurant room (+ public order room)
   */
  broadcastOrderCancelled(payload: OrderEventPayload): void {
    this.io.to(`restaurant:${payload.restaurant_id}`).emit(SocketEvent.ORDER_CANCELLED, payload);
    if (payload.order_number) {
      this.io.to(`order:${payload.order_number}`).emit(SocketEvent.ORDER_CANCELLED, payload);
    }
  }

  /**
   * Broadcast delayed order alert to restaurant room.
   * Fired by the background delay-detector job when an active order
   * has been in PREPARING/ACCEPTED/CREATED status longer than the
   * restaurant's configured delay_threshold_minutes.
   */
  broadcastOrderDelayed(payload: DelayedOrderPayload): void {
    this.io.to(`restaurant:${payload.restaurant_id}`).emit(SocketEvent.ORDER_DELAYED, payload);
  }

  /**
   * Broadcast a new reservation to the restaurant room (owner dashboard).
   */
  broadcastReservationCreated(payload: ReservationEventPayload): void {
    this.io.to(`restaurant:${payload.restaurant_id}`).emit(SocketEvent.RESERVATION_CREATED, payload);
  }

  /**
   * Broadcast payment created event to restaurant room
   */
  broadcastPaymentCreated(payload: PaymentEventPayload): void {
    this.io.to(`restaurant:${payload.restaurant_id}`).emit(SocketEvent.PAYMENT_CREATED, payload);
  }

  /**
   * Broadcast payment updated event to restaurant room
   */
  broadcastPaymentUpdated(payload: PaymentEventPayload): void {
    this.io.to(`restaurant:${payload.restaurant_id}`).emit(SocketEvent.PAYMENT_UPDATED, payload);
  }

  /**
   * Broadcast payment completed event to restaurant room
   */
  broadcastPaymentCompleted(payload: PaymentEventPayload): void {
    this.io.to(`restaurant:${payload.restaurant_id}`).emit(SocketEvent.PAYMENT_COMPLETED, payload);
  }

  /**
   * Broadcast low stock inventory alert to restaurant room
   */
  broadcastInventoryLowStock(payload: InventoryEventPayload): void {
    this.io.to(`restaurant:${payload.restaurant_id}`).emit(SocketEvent.INVENTORY_LOW_STOCK, payload);
  }

  /**
   * Broadcast inventory update to restaurant room
   */
  broadcastInventoryUpdated(payload: InventoryEventPayload): void {
    this.io.to(`restaurant:${payload.restaurant_id}`).emit(SocketEvent.INVENTORY_UPDATED, payload);
  }

  /**
   * Broadcast table occupied event to restaurant room
   */
  broadcastTableOccupied(payload: TableEventPayload): void {
    this.io.to(`restaurant:${payload.restaurant_id}`).emit(SocketEvent.TABLE_OCCUPIED, payload);
  }

  /**
   * Broadcast table freed event to restaurant room
   */
  broadcastTableFreed(payload: TableEventPayload): void {
    this.io.to(`restaurant:${payload.restaurant_id}`).emit(SocketEvent.TABLE_FREED, payload);
  }

  broadcastTableCreated(payload: TableEventPayload): void {
    this.io.to(`restaurant:${payload.restaurant_id}`).emit(SocketEvent.TABLE_CREATED, payload);
  }

  broadcastTableUpdated(payload: TableEventPayload): void {
    this.io.to(`restaurant:${payload.restaurant_id}`).emit(SocketEvent.TABLE_UPDATED, payload);
  }

  broadcastTableDeleted(restaurantId: string, tableId: string): void {
    this.io.to(`restaurant:${restaurantId}`).emit(SocketEvent.TABLE_DELETED, { table_id: tableId, restaurant_id: restaurantId });
  }

  /**
   * Broadcast error event to restaurant room
   */
  broadcastError(restaurantId: string, error: { code: string; message: string }): void {
    this.io.to(`restaurant:${restaurantId}`).emit(SocketEvent.ERROR, error);
  }
}

export let eventBroadcaster: EventBroadcaster;

/**
 * Initialize event broadcaster with Socket.io instance
 */
export function initializeEventBroadcaster(io: SocketIOServer): EventBroadcaster {
  eventBroadcaster = new EventBroadcaster(io);
  return eventBroadcaster;
}
