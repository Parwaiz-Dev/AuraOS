/**
 * Shared super-admin allowlist helper.
 *
 * Platform owners are identified by an email allowlist in the environment
 * (SUPER_ADMIN_EMAILS), NOT by a database role — every DB user belongs to a
 * single restaurant. This helper centralises the check so the auth profile
 * and the superAdmin route guard agree on who is a platform owner.
 */
import { env } from '@/config/env';

const SUPER_ADMIN_EMAILS = new Set(
  env.SUPER_ADMIN_EMAILS
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0),
);

/** True if the given email is a configured platform super-admin. */
export function isSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.has(email.toLowerCase());
}
