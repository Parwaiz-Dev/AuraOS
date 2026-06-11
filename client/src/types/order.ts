export type OrderStatus =
  | "CREATED"
  | "ACCEPTED"
  | "PREPARING"
  | "READY"
  | "COMPLETED"
  | "CANCELLED";

export type OrderType = "DINE_IN" | "PARCEL" | "ONLINE";

export type OrderSource = "WAITER" | "RECEPTION" | "QR" | "WHATSAPP" | "ZOMATO";

export interface OrderItemModifier {
  modifier_group_name: string;
  modifier_option_name: string;
  price_adjustment: number;
}

export interface OrderItem {
  id?: string;
  order_id?: string;
  restaurant_id?: string;

  menu_item_id: string;

  menu_item_name?: string;

  quantity: number;

  unit_price?: number;

  special_instructions?: string;

  status?: string;

  modifiers?: OrderItemModifier[];
}

export interface OrderTable {
  id: string;
  table_number: number;
}

export interface Order {
  id: string;

  restaurant_id: string;

  table_id: string | null;

  table?: OrderTable | null;

  order_number: string;

  order_type: OrderType;

  order_source: OrderSource;

  status: OrderStatus;

  total_amount: number;

  priority_score: number;

  special_instructions?: string;

  created_by?: string | null;

  created_at: string;

  updated_at: string;

  completed_at: string | null;

  items?: OrderItem[];

  order_items?: OrderItem[];
}
