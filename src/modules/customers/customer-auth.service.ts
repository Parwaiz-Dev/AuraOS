/**
 * Customer authentication — phone + OTP.
 *
 * Separate from staff auth (users table / authenticate middleware). Customers are
 * global (one identity across restaurants). Login flow:
 *   1. requestOtp(phone)  -> generate 6-digit code, store hashed, "send" it
 *   2. verifyOtp(phone, code) -> on match, upsert customer + issue a customer JWT
 *
 * OTP storage: Redis (TTL) when available, else the customer_otps table. The code
 * is only ever stored hashed. In development (no SMS provider) the code is logged
 * and returned in the response so the flow is testable.
 */

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { query } from '@/config/database';
import { cacheGet, cacheSet, cacheDel, isRedisAvailable } from '@/config/redis';
import { env } from '@/config/env';
import { BadRequestError, UnauthorizedError } from '@/shared/errors/AppError';

const OTP_TTL_SECONDS = 300; // 5 minutes
const MAX_ATTEMPTS = 5;
const CUSTOMER_JWT_EXPIRY = '30d'; // customers stay logged in longer than staff

export interface CustomerJWTPayload {
  customerId: string;
  phone: string;
  kind: 'customer';
}

function hashCode(phone: string, code: string): string {
  return crypto.createHash('sha256').update(`${phone}:${code}`).digest('hex');
}

function otpKey(phone: string): string {
  return `otp:customer:${phone}`;
}

/** E.164-ish normalization: keep leading +, strip spaces/dashes. */
function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  const plus = trimmed.startsWith('+') ? '+' : '';
  return plus + trimmed.replace(/[^0-9]/g, '');
}

function generateCode(): string {
  // 6-digit, cryptographically random, zero-padded.
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

function signCustomerToken(customerId: string, phone: string): string {
  const payload: CustomerJWTPayload = { customerId, phone, kind: 'customer' };
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: CUSTOMER_JWT_EXPIRY, algorithm: 'HS256' });
}

export function verifyCustomerToken(token: string): CustomerJWTPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET) as CustomerJWTPayload;
  if (decoded.kind !== 'customer') throw new UnauthorizedError('Not a customer token');
  return decoded;
}

export const customerAuthService = {
  async requestOtp(rawPhone: string): Promise<{ devCode?: string }> {
    const phone = normalizePhone(rawPhone);
    if (phone.replace('+', '').length < 8) throw new BadRequestError('Invalid phone number');

    const code = generateCode();
    const codeHash = hashCode(phone, code);

    if (isRedisAvailable()) {
      // Store hash + attempts in Redis with TTL.
      await cacheSet(otpKey(phone), JSON.stringify({ codeHash, attempts: 0 }), OTP_TTL_SECONDS);
    } else {
      // DB fallback: invalidate prior unconsumed codes, insert fresh.
      await query(`UPDATE customer_otps SET consumed_at = NOW() WHERE phone = $1 AND consumed_at IS NULL`, [phone]);
      await query(
        `INSERT INTO customer_otps (phone, code_hash, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '${OTP_TTL_SECONDS} seconds')`,
        [phone, codeHash],
      );
    }

    // TODO(Phase 2 follow-up): send via SMS provider (MSG91/Twilio).
    // Until then, log it and (in non-production) return it so the flow is testable.
    console.log(`[customer-otp] ${phone} -> ${code}`);
    return env.NODE_ENV === 'production' ? {} : { devCode: code };
  },

  async verifyOtp(rawPhone: string, code: string): Promise<{ token: string; customer: { id: string; phone: string; name: string | null } }> {
    const phone = normalizePhone(rawPhone);
    const codeHash = hashCode(phone, code);

    let ok = false;

    if (isRedisAvailable()) {
      const raw = await cacheGet(otpKey(phone));
      if (!raw) throw new UnauthorizedError('Code expired or not requested');
      const data = JSON.parse(raw) as { codeHash: string; attempts: number };
      if (data.attempts >= MAX_ATTEMPTS) {
        await cacheDel(otpKey(phone));
        throw new UnauthorizedError('Too many attempts — request a new code');
      }
      ok = data.codeHash === codeHash;
      if (ok) {
        await cacheDel(otpKey(phone));
      } else {
        await cacheSet(otpKey(phone), JSON.stringify({ ...data, attempts: data.attempts + 1 }), OTP_TTL_SECONDS);
      }
    } else {
      const res = await query(
        `SELECT id, code_hash, attempts FROM customer_otps
         WHERE phone = $1 AND consumed_at IS NULL AND expires_at > NOW()
         ORDER BY created_at DESC LIMIT 1`,
        [phone],
      );
      const row = res.rows[0];
      if (!row) throw new UnauthorizedError('Code expired or not requested');
      if (row.attempts >= MAX_ATTEMPTS) throw new UnauthorizedError('Too many attempts — request a new code');
      ok = row.code_hash === codeHash;
      if (ok) {
        await query(`UPDATE customer_otps SET consumed_at = NOW() WHERE id = $1`, [row.id]);
      } else {
        await query(`UPDATE customer_otps SET attempts = attempts + 1 WHERE id = $1`, [row.id]);
      }
    }

    if (!ok) throw new UnauthorizedError('Incorrect code');

    // Upsert the customer by phone.
    const upsert = await query(
      `INSERT INTO customers (phone) VALUES ($1)
       ON CONFLICT (phone) DO UPDATE SET updated_at = NOW()
       RETURNING id, phone, name`,
      [phone],
    );
    const customer = upsert.rows[0];
    const token = signCustomerToken(customer.id, customer.phone);
    return { token, customer };
  },
};
