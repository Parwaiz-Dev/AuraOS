import { z } from 'zod';

export const CreateUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  role: z.enum(['ADMIN', 'WAITER', 'RECEPTION', 'KITCHEN']),
});

export const UpdateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  role: z.enum(['ADMIN', 'WAITER', 'RECEPTION', 'KITCHEN']).optional(),
  is_active: z.boolean().optional(),
});

export const ChangePasswordSchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

export type CreateUserRequest = z.infer<typeof CreateUserSchema>;
export type UpdateUserRequest = z.infer<typeof UpdateUserSchema>;
export type ChangePasswordRequest = z.infer<typeof ChangePasswordSchema>;

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'WAITER' | 'RECEPTION' | 'KITCHEN';
  restaurant_id: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}
