import { query } from '@/config/database';
import { AuthUser } from './auth.types';

export class AuthRepository {
  async findByEmailAndRestaurant(email: string, restaurantId: string): Promise<AuthUser | null> {
    const result = await query(
      'SELECT id, email, name, role, restaurant_id, password_hash, is_active, created_at FROM users WHERE email = $1 AND restaurant_id = $2 LIMIT 1',
      [email, restaurantId],
    );
    return result.rows[0] || null;
  }

  async findByEmail(email: string): Promise<(AuthUser & { password_hash: string }) | null> {
    const result = await query(
      'SELECT id, email, name, role, restaurant_id, password_hash, is_active, created_at FROM users WHERE email = $1 LIMIT 1',
      [email],
    );
    return result.rows[0] || null;
  }

  async findById(userId: string): Promise<AuthUser | null> {
    const result = await query(
      'SELECT id, email, name, role, restaurant_id, is_active, created_at FROM users WHERE id = $1 LIMIT 1',
      [userId],
    );
    return result.rows[0] || null;
  }

  async create(restaurantId: string, email: string, passwordHash: string, name: string, role: string): Promise<AuthUser> {
    const result = await query(
      `INSERT INTO users (restaurant_id, email, password_hash, name, role, is_active)
       VALUES ($1, $2, $3, $4, $5, TRUE)
       RETURNING id, email, name, role, restaurant_id, is_active, created_at`,
      [restaurantId, email, passwordHash, name, role],
    );
    return result.rows[0];
  }

  async getUserWithPassword(userId: string): Promise<(AuthUser & { password_hash: string }) | null> {
    const result = await query(
      'SELECT id, email, name, role, restaurant_id, password_hash, is_active, created_at FROM users WHERE id = $1 LIMIT 1',
      [userId],
    );
    return result.rows[0] || null;
  }

  async emailExistsInRestaurant(email: string, restaurantId: string): Promise<boolean> {
    const result = await query(
      'SELECT 1 FROM users WHERE email = $1 AND restaurant_id = $2 LIMIT 1',
      [email, restaurantId],
    );
    return result.rows.length > 0;
  }

  // ── Password reset ────────────────────────────────────────────────────────

  async createResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await query(
      `DELETE FROM password_reset_tokens WHERE user_id = $1 AND used_at IS NULL`,
      [userId],
    );
    await query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [userId, tokenHash, expiresAt],
    );
  }

  async findValidResetToken(tokenHash: string): Promise<{ id: string; user_id: string } | null> {
    const result = await query(
      `SELECT id, user_id FROM password_reset_tokens
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
       LIMIT 1`,
      [tokenHash],
    );
    return result.rows[0] || null;
  }

  async markTokenUsed(tokenId: string): Promise<void> {
    await query(`UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`, [tokenId]);
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [passwordHash, userId]);
  }

  async deleteExpiredTokens(): Promise<number> {
    const result = await query(
      `DELETE FROM password_reset_tokens WHERE expires_at < NOW() OR used_at IS NOT NULL`,
    );
    return result.rowCount ?? 0;
  }

  // ── Refresh tokens ────────────────────────────────────────────────────────

  async storeRefreshToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [userId, tokenHash, expiresAt],
    );
  }

  async findValidRefreshToken(tokenHash: string): Promise<{ user_id: string } | null> {
    const result = await query(
      `SELECT user_id FROM refresh_tokens
       WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > NOW()
       LIMIT 1`,
      [tokenHash],
    );
    return result.rows[0] || null;
  }

  async revokeRefreshToken(tokenHash: string): Promise<void> {
    await query(
      `UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1`,
      [tokenHash],
    );
  }

  async revokeAllRefreshTokens(userId: string): Promise<void> {
    await query(
      `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId],
    );
  }

  /**
   * Revoke all refresh tokens for every user in a restaurant.
   * Called when a restaurant is suspended — forces all staff to re-login
   * once their current short-lived access token expires (≤15m).
   */
  async revokeAllRefreshTokensForRestaurant(restaurantId: string): Promise<void> {
    await query(
      `UPDATE refresh_tokens rt
       SET revoked_at = NOW()
       FROM users u
       WHERE u.id = rt.user_id
         AND u.restaurant_id = $1
         AND rt.revoked_at IS NULL`,
      [restaurantId],
    );
  }
}

export const authRepository = new AuthRepository();
