/**
 * Seed script — creates default users in the in-memory or PostgreSQL store.
 *
 * Called automatically by the backend on startup (see app.js).
 * Safe to run repeatedly — skips users that already exist.
 *
 * Default accounts:
 *   admin@mindsafe.dev   / Admin@123   (admin)
 *   doctor@mindsafe.dev  / Doctor@123  (psychologist)
 *   user@mindsafe.dev    / User@123    (user)
 */

const bcrypt = require("bcryptjs");
const { BCRYPT_ROUNDS } = require("./src/config/env");

const SEED_USERS = [
  {
    email: "admin@mindsafe.dev",
    password: "Admin@123",
    role: "admin",
  },
  {
    email: "doctor@mindsafe.dev",
    password: "Doctor@123",
    role: "psychologist",
  },
  {
    email: "user@mindsafe.dev",
    password: "User@123",
    role: "user",
  },
];

async function seedUsers(userStore) {
  let created = 0;

  for (const seed of SEED_USERS) {
    const existing = await userStore.findUserByEmail(seed.email);
    if (existing) {
      continue;
    }

    const passwordHash = await bcrypt.hash(seed.password, BCRYPT_ROUNDS);

    await userStore.addUser({
      email: seed.email,
      passwordHash,
      isVerified: true,
      provider: "local",
      role: seed.role,
    });

    created++;
    console.log(`  Seeded: ${seed.email} (${seed.role})`);
  }

  if (created > 0) {
    console.log(`Seed complete: ${created} user(s) created`);
  }
}

module.exports = { seedUsers, SEED_USERS };
