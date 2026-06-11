import { z } from 'zod';

export const LoginRequestSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const RegisterRequestSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  role: z.enum(['ADMIN', 'WAITER', 'RECEPTION', 'KITCHEN'], {
    errorMap: () => ({ message: 'Invalid role' }),
  }),
});

export const RefreshTokenRequestSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type RefreshTokenRequest = z.infer<typeof RefreshTokenRequestSchema>;

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'WAITER' | 'RECEPTION' | 'KITCHEN';
  restaurant_id: string;
  is_active?: boolean;
  is_super_admin?: boolean;
  created_at: Date;
}

export interface JWTPayload {
  id: string;
  email: string;
  role: string;
  restaurantId: string;
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  token: string;
  refreshToken: string;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  user: Partial<AuthUser>;
}
