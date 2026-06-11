import { z } from 'zod';

export const CreatePaymentRequestSchema = z.object({
  order_id: z.string().uuid('Order ID must be a valid UUID'),
  amount: z.number().positive('Amount must be a positive number'),
  method: z.enum(['CASH', 'CARD', 'UPI', 'ONLINE']),
  status: z.enum(['PENDING', 'PAID', 'REFUNDED']).optional(),
  reference_number: z.string().max(255).optional(),
});

export const UpdatePaymentRequestSchema = z.object({
  amount: z.number().positive('Amount must be a positive number').optional(),
  method: z.enum(['CASH', 'CARD', 'UPI', 'ONLINE']).optional(),
  status: z.enum(['PENDING', 'PAID', 'REFUNDED']).optional(),
  reference_number: z.string().max(255).optional(),
});

export type CreatePaymentRequest = z.infer<typeof CreatePaymentRequestSchema>;
export type UpdatePaymentRequest = z.infer<typeof UpdatePaymentRequestSchema>;

export interface Payment {
  id: string;
  restaurant_id: string;
  order_id: string;
  amount: number;
  method: 'CASH' | 'CARD' | 'UPI' | 'ONLINE';
  status: 'PENDING' | 'PAID' | 'REFUNDED';
  reference_number?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface PaymentStats {
  payments_today: number;
  paid_amount_today: number;
  refunded_amount_today: number;
  pending_payments_today: number;
}
