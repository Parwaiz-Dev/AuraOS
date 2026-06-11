import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { authRepository } from './auth.repository';
import { isSuperAdminEmail } from '@/shared/utils/superAdmin';
import {
  AuthUser,
  JWTPayload,
  TokenPair,
  AuthResponse,
  LoginRequest,
  RegisterRequest,
} from './auth.types';
import { UnauthorizedError, ConflictError, NotFoundError, BadRequestError } from '@/shared/errors/AppError';
import { env } from '@/config/env';
import { sendPasswordResetEmail } from '@/config/email';

const JWT_SECRET = env.JWT_SECRET;
const JWT_REFRESH_SECRET = env.JWT_REFRESH_SECRET;
const JWT_EXPIRY = env.JWT_EXPIRES_IN;
const JWT_REFRESH_EXPIRY = env.JWT_REFRESH_EXPIRES_IN;

export class AuthService {
  async hashPassword(password: string): Promise<string> {
    const salt = await bcryptjs.genSalt(10);
    return bcryptjs.hash(password, salt);
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcryptjs.compare(password, hash);
  }

  generateToken(payload: JWTPayload): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY as any, algorithm: 'HS256' });
  }

  generateRefreshToken(payload: JWTPayload): string {
    return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRY as any, algorithm: 'HS256' });
  }

  verifyToken(token: string): JWTPayload | null {
    try {
      return jwt.verify(token, JWT_SECRET) as JWTPayload;
    } catch {
      return null;
    }
  }

  verifyRefreshToken(token: string): JWTPayload | null {
    try {
      return jwt.verify(token, JWT_REFRESH_SECRET) as JWTPayload;
    } catch {
      return null;
    }
  }

  private hashToken(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  private refreshTokenExpiryDate(): Date {
    const match = JWT_REFRESH_EXPIRY.match(/^(\d+)([dhm])$/);
    if (match) {
      const n = parseInt(match[1], 10);
      const unit = match[2];
      const ms = unit === 'd' ? n * 86400000 : unit === 'h' ? n * 3600000 : n * 60000;
      return new Date(Date.now() + ms);
    }
    return new Date(Date.now() + 7 * 86400000);
  }

  async register(payload: RegisterRequest, restaurantId: string): Promise<AuthResponse> {
    const { email, password, name, role } = payload;

    const exists = await authRepository.emailExistsInRestaurant(email, restaurantId);
    if (exists) throw new ConflictError('Email already registered in this restaurant');

    const passwordHash = await this.hashPassword(password);
    const user = await authRepository.create(restaurantId, email, passwordHash, name, role);

    const jwtPayload: JWTPayload = { id: user.id, email: user.email, role: user.role, restaurantId: user.restaurant_id };
    const token = this.generateToken(jwtPayload);
    const refreshToken = this.generateRefreshToken(jwtPayload);

    return {
      token,
      refreshToken,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, restaurant_id: user.restaurant_id },
    };
  }

  async login(payload: LoginRequest): Promise<AuthResponse> {
    const { email, password } = payload;

    const user = await authRepository.findByEmail(email);
    if (!user) throw new UnauthorizedError('Invalid email or password');

    const isValid = await this.comparePassword(password, user.password_hash);
    if (!isValid) throw new UnauthorizedError('Invalid email or password');

    if (!user.is_active) throw new UnauthorizedError('User account is disabled');

    const jwtPayload: JWTPayload = { id: user.id, email: user.email, role: user.role, restaurantId: user.restaurant_id };
    const token = this.generateToken(jwtPayload);
    const refreshToken = this.generateRefreshToken(jwtPayload);

    // Store hashed refresh token so it can be revoked on logout or password reset
    await authRepository.storeRefreshToken(user.id, this.hashToken(refreshToken), this.refreshTokenExpiryDate());

    return {
      token,
      refreshToken,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, restaurant_id: user.restaurant_id },
    };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    // Verify JWT signature first (fast, no DB hit)
    const payload = this.verifyRefreshToken(refreshToken);
    if (!payload) throw new UnauthorizedError('Invalid or expired refresh token');

    // Check the token hasn't been revoked in the DB
    const tokenHash = this.hashToken(refreshToken);
    const stored = await authRepository.findValidRefreshToken(tokenHash);
    if (!stored) throw new UnauthorizedError('Refresh token has been revoked');

    const user = await authRepository.findById(payload.id);
    if (!user || !user.is_active) throw new UnauthorizedError('User no longer exists or is inactive');

    // Revoke the used token (token rotation — each token can only be used once)
    await authRepository.revokeRefreshToken(tokenHash);

    const newPayload: JWTPayload = { id: user.id, email: user.email, role: user.role, restaurantId: user.restaurant_id };
    const newToken = this.generateToken(newPayload);
    const newRefreshToken = this.generateRefreshToken(newPayload);

    await authRepository.storeRefreshToken(user.id, this.hashToken(newRefreshToken), this.refreshTokenExpiryDate());

    return { token: newToken, refreshToken: newRefreshToken };
  }

  async getProfile(userId: string): Promise<AuthUser> {
    const user = await authRepository.findById(userId);
    if (!user) throw new NotFoundError('User not found');
    return { ...user, is_super_admin: isSuperAdminEmail(user.email) };
  }

  async logout(refreshToken: string): Promise<void> {
    // Revoke the specific refresh token so it can't be used after logout
    if (refreshToken) {
      await authRepository.revokeRefreshToken(this.hashToken(refreshToken));
    }
  }

  // ── Password reset ──────────────────────────────────────────────────────────

  async requestPasswordReset(email: string): Promise<void> {
    const user = await authRepository.findByEmail(email);
    if (!user || !user.is_active) return; // always succeed — don't reveal email existence

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await authRepository.createResetToken(user.id, tokenHash, expiresAt);
    await sendPasswordResetEmail(user.email, user.name, rawToken, env.APP_URL);
  }

  async confirmPasswordReset(rawToken: string, newPassword: string): Promise<void> {
    if (!rawToken || rawToken.length < 10) throw new BadRequestError('Invalid reset token');
    if (newPassword.length < 8) throw new BadRequestError('Password must be at least 8 characters');

    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const tokenRecord = await authRepository.findValidResetToken(tokenHash);
    if (!tokenRecord) throw new BadRequestError('Reset token is invalid or has expired');

    const passwordHash = await this.hashPassword(newPassword);
    await authRepository.updatePassword(tokenRecord.user_id, passwordHash);
    await authRepository.markTokenUsed(tokenRecord.id);

    // Revoke all refresh tokens — forces re-login after password change
    await authRepository.revokeAllRefreshTokens(tokenRecord.user_id);
  }
}

export const authService = new AuthService();
