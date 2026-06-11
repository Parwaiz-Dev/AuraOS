/**
 * Create a platform super-admin user.
 *
 * This creates a user that belongs to the FIRST restaurant in the system
 * (or creates a placeholder "AuraOS Platform" restaurant if none exists).
 * The user gets ADMIN role so they can log in normally, and their email
 * is added to SUPER_ADMIN_EMAILS in .env to grant platform-owner access.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/create-super-admin.ts <email> <password> <name>
 *
 * Example:
 *   npx ts-node -r tsconfig-paths/register scripts/create-super-admin.ts waliozing@gmail.com MyPassword123 "Walio"
 */

import * as dotenv from 'dotenv';
dotenv.config();
import bcryptjs from 'bcryptjs';
import { pool } from '../src/config/database';

async function run() {
  const [email, password, name] = process.argv.slice(2);

  if (!email || !password) {
    console.error('\n❌ Usage: npx ts-node -r tsconfig-paths/register scripts/create-super-admin.ts <email> <password> [name]\n');
    process.exit(1);
  }

  const displayName = name || email.split('@')[0];

  try {
    // Check if user already exists
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      console.log(`\nℹ️  User ${email} already exists (id: ${existing.rows[0].id}).`);
      console.log(`   Just add their email to SUPER_ADMIN_EMAILS in .env and restart.\n`);
      await pool.end();
      return;
    }

    // Find or create a platform restaurant for the super-admin to belong to
    let restaurantId: string;
    const platformRes = await pool.query(
      `SELECT id FROM restaurants WHERE slug = 'auraos-platform' LIMIT 1`,
    );

    if (platformRes.rows.length > 0) {
      restaurantId = platformRes.rows[0].id;
    } else {
      // Create a platform-level restaurant (hidden from customers)
      const newRes = await pool.query(
        `INSERT INTO restaurants (name, slug, auto_approve_online_orders, delay_threshold_minutes)
         VALUES ('AuraOS Platform', 'auraos-platform', FALSE, 15)
         RETURNING id`,
      );
      restaurantId = newRes.rows[0].id;
      console.log('  Created platform restaurant: AuraOS Platform');

      // Also create a trial subscription for it
      await pool.query(
        `INSERT INTO subscriptions (restaurant_id, status, trial_started_at, trial_ends_at)
         VALUES ($1, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '100 years')
         ON CONFLICT (restaurant_id) DO NOTHING`,
        [restaurantId],
      );
    }

    // Create the user
    const salt = await bcryptjs.genSalt(10);
    const hash = await bcryptjs.hash(password, salt);

    const userRes = await pool.query(
      `INSERT INTO users (restaurant_id, email, password_hash, name, role, is_active)
       VALUES ($1, $2, $3, $4, 'ADMIN', TRUE)
       RETURNING id, email, name`,
      [restaurantId, email.toLowerCase(), hash, displayName],
    );

    const user = userRes.rows[0];

    console.log('\n✅ Super-admin created successfully!');
    console.log('─'.repeat(40));
    console.log(`  Email:    ${user.email}`);
    console.log(`  Name:     ${user.name}`);
    console.log(`  Password: (the one you provided)`);
    console.log('─'.repeat(40));
    console.log('\n📋 Next steps:');
    console.log(`  1. Add to .env:  SUPER_ADMIN_EMAILS=${user.email}`);
    console.log('  2. Restart the backend (npm run dev)');
    console.log(`  3. Log in at http://localhost:3001 with ${user.email}`);
    console.log('  4. You\'ll see "Platform (Owner)" in the sidebar\n');
  } catch (err: any) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
