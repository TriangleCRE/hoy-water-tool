#!/usr/bin/env node
// Alias for scripts/migrate.mjs.
//
// Schema creation and seeding are deliberately kept as one atomic,
// lock-guarded operation in lib/db.js's ensureReady() — that's what makes it
// safe to run concurrently (see the advisory-lock comment there), so this
// script doesn't duplicate that logic or try to seed independently of
// creating the tables. It's provided under this name for anyone who goes
// looking for a "seed" script specifically; behavior is identical to
// `node scripts/migrate.mjs`.
//
// Usage:
//   vercel env pull .env.local   # pulls DATABASE_URL etc. from the project
//   node --env-file=.env.local scripts/seed.js
// or simply:
//   DATABASE_URL="postgres://..." node scripts/seed.js

import { ensureReady } from "../lib/db.js";

try {
  const result = await ensureReady();
  console.log("Schema is ready.");
  if (result && result.seeded) {
    console.log(
      `Seeded ${result.tenants} tenant(s), ${result.readings} reading(s), ${result.bills} bill(s).`
    );
  } else {
    console.log("Tables already contained data — nothing to seed, left as-is.");
  }
  process.exit(0);
} catch (err) {
  console.error("Seed failed:", err.message || err);
  process.exit(1);
}
