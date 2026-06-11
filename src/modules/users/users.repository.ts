import { query } from '@/config/database';
import { UserProfile } from './users.types';

export class UsersRepository {
  async findAll(restaurantId: string, limit = 50, offset = 0): Promise<UserProfile[]> {
    const result = await query(
      `SELECT id, email, name, role, restaurant_id, is_active, created_at, updated_at
       FROM users
       WHERE restaurant_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [restaurantId, limit, offset]
    );
    return result.rows;
  }

  async findById(userId: string): Promise<UserProfile | null> {
    const result = await query(
      `SELECT id, email, name, role, restaurant_id, is_active, created_at, updated_at
       FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    );
    return result.rows[0] || null;
  }

  async emailExistsInRestaurant(email: string, restaurantId: string, excludeId?: string): Promise<boolean> {
    let sql = `SELECT 1 FROM users WHERE email = $1 AND restaurant_id = $2`;
    const params: any[] = [email, restaurantId];
    if (excludeId) {
      sql += ` AND id != $3`;
      params.push(excludeId);
    }
    const result = await query(sql, params);
    return result.rows.length > 0;
  }

  async create(
    restaurantId: string,
    email: string,
    passwordHash: string,
    name: string,
    role: string
  ): Promise<UserProfile> {
    const result = await query(
      `INSERT INTO users (restaurant_id, email, password_hash, name, role, is_active)
       VALUES ($1, $2, $3, $4, $5, TRUE)
       RETURNING id, email, name, role, restaurant_id, is_active, created_at, updated_at`,
      [restaurantId, email, passwordHash, name, role]
    );
    return result.rows[0];
  }

  async update(userId: string, updates: Partial<{ name: string; email: string; role: string; is_active: boolean }>): Promise<UserProfile | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (updates.name !== undefined) { fields.push(`name = $${idx++}`); values.push(updates.name); }
    if (updates.email !== undefined) { fields.push(`email = $${idx++}`); values.push(updates.email); }
    if (updates.role !== undefined) { fields.push(`role = $${idx++}`); values.push(updates.role); }
    if (updates.is_active !== undefined) { fields.push(`is_active = $${idx++}`); values.push(updates.is_active); }

    if (fields.length === 0) return this.findById(userId);

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(userId);

    const result = await query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx}
       RETURNING id, email, name, role, restaurant_id, is_active, created_at, updated_at`,
      values
    );
    return result.rows[0] || null;
  }

  async updatePassword(userId: string, passwordHash: string): Promise<boolean> {
    const result = await query(
      `UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [passwordHash, userId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async delete(userId: string): Promise<boolean> {
    const result = await query(`DELETE FROM users WHERE id = $1`, [userId]);
    return (result.rowCount ?? 0) > 0;
  }

  async count(restaurantId: string): Promise<number> {
    const result = await query(`SELECT COUNT(*) as count FROM users WHERE restaurant_id = $1`, [restaurantId]);
    return parseInt(result.rows[0].count) || 0;
  }
}

export const usersRepository = new UsersRepository();
