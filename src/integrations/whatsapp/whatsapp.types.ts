import { z } from 'zod';

/**
 * WhatsApp API payload types (Meta WhatsApp Business API)
 */
export const WhatsAppMessageSchema = z.object({
  messaging_product: z.literal('whatsapp'),
  metadata: z.object({
    display_phone_number: z.string(),
    phone_number_id: z.string(),
  }),
  contacts: z.array(
    z.object({
      profile: z.object({
        name: z.string(),
      }),
      wa_id: z.string(),
    })
  ),
  messages: z.array(
    z.object({
      from: z.string(),
      id: z.string(),
      timestamp: z.string(),
      text: z.object({
        body: z.string(),
      }).optional(),
      type: z.enum(['text', 'button', 'interactive']),
    })
  ),
});

export type WhatsAppMessage = z.infer<typeof WhatsAppMessageSchema>;

export interface WhatsAppConversationState {
  user_id: string;
  restaurant_id: string;
  phone_number: string;
  customer_name: string;
  state: 'MENU_BROWSING' | 'ITEM_SELECTED' | 'ORDER_SUMMARY' | 'ORDER_PLACED';
  cart_items: Array<{ item_name: string; quantity: number; price: number }>;
  conversation_id: string;
}

export interface WhatsAppOrderPayload {
  customer_phone: string;
  customer_name: string;
  items: Array<{ item_name: string; quantity: number; unit_price: number }>;
  total_amount: number;
  notes: string;
}
