/**
 * One-shot script to create the initial super_admin user.
 *
 * Usage:
 *   npm run seed:admin
 *
 * Reads SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_ADMIN_NAME from .env.
 * If a user with that email already exists and has role super_admin, exits.
 * If exists with a different role, refuses to clobber.
 */

import mongoose from 'mongoose';
import { env } from '../config/env';
import { User } from '../models/User';

async function run() {
  const name = process.env.SEED_ADMIN_NAME || 'Super Admin';
  const email = (process.env.SEED_ADMIN_EMAIL || '').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || '';

  if (!email || !password) {
    console.error(
      '✘ SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set in .env'
    );
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('✘ SEED_ADMIN_PASSWORD must be at least 8 characters');
    process.exit(1);
  }

  await mongoose.connect(env.MONGODB_URI);
  console.log('✔ MongoDB connected');

  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.role === 'super_admin') {
      console.log(`✔ Super-admin already exists: ${email}`);
    } else {
      console.error(
        `✘ A non-super-admin user with email ${email} already exists. Refusing to clobber.`
      );
      process.exit(1);
    }
  } else {
    await User.create({
      name,
      email,
      password,
      role: 'super_admin',
    });
    console.log(`✔ Super-admin created: ${email}`);
    console.log(`  Password: (as set in SEED_ADMIN_PASSWORD)`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
