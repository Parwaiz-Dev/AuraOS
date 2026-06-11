import { z } from 'zod';

export const CreateTableRequestSchema = z.object({
  table_number: z.string().min(1, 'Table number is required').max(50, 'Table number must be less than 50 characters'),
  seats: z.number().int().min(1).max(20).default(2),
});

export const UpdateTableRequestSchema = z.object({
  table_number: z.string().min(1, 'Table number is required').max(50, 'Table number must be less than 50 characters').optional(),
  seats: z.number().int().min(1).max(20).optional(),
  is_active: z.boolean().optional(),
});

export type CreateTableRequest = z.infer<typeof CreateTableRequestSchema>;
export type UpdateTableRequest = z.infer<typeof UpdateTableRequestSchema>;

export interface Table {
  id: string;
  restaurant_id: string;
  table_number: string;
  seats: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface TableStats {
  total_tables: number;
  active_tables: number;
  total_seats: number;
  active_seats: number;
}

export interface TableWithStats extends Table {
  stats?: TableStats;
}