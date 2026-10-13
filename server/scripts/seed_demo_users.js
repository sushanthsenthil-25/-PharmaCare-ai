import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { connectDB } from '../config/db.js';

export const DEMO_USERS = [
  {
    email: 'sushanth@gmail.com',
    password: '123456',
    name: 'Sushanth Senthil',
    role: 'USER',
    businessName: 'PharmaCare Customer',
    phone: '+91 98765 43210',
    address: 'Indiranagar, Bangalore 560038',
  },
  {
    email: 'pharmacare@gmail.com',
    password: '789456',
    name: 'PharmaCare Pharmacy Owner',
    role: 'OWNER',
    businessName: 'PharmaCare Central Pharmacy',
    phone: '+91 98765 00000',
    address: 'Koramangala, Bangalore 560034',
  },
];

export const seedDemoUsers = async () => {
  try {
    if (mongoose.connection.readyState !== 1) {
      await connectDB();
    }
    if (mongoose.connection.readyState !== 1) {
      console.warn('[Seed] Database not connected. Skipping demo user seeding.');
      return;
    }

    for (const demo of DEMO_USERS) {
      const existing = await User.findOne({ email: demo.email.toLowerCase() });
      if (!existing) {
        // User.create triggers Mongoose pre('save') which hashes password with bcrypt
        const created = await User.create({
          name: demo.name,
          email: demo.email.toLowerCase(),
          password: demo.password,
          role: demo.role,
          businessName: demo.businessName,
          phone: demo.phone,
          address: demo.address,
        });
        console.log(`[Seed] Created demo ${demo.role} account: ${created.email} (ID: ${created._id})`);
      } else {
        console.log(`[Seed] Demo account already exists: ${demo.email} (Role: ${existing.role})`);
      }
    }
  } catch (err) {
    console.error('[Seed Error] Failed to seed demo users:', err.message);
  }
};

// If run directly from CLI
if (process.argv[1]?.endsWith('seed_demo_users.js')) {
  (async () => {
    console.log('[Seed] Starting demo user seeding...');
    await seedDemoUsers();
    await mongoose.disconnect();
    console.log('[Seed] Done.');
    process.exit(0);
  })();
}
