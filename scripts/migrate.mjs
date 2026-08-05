#!/usr/bin/env node
// One-time (idempotent) setup: creates the tenants/readings/bills tables
// and loads them with the starter data that used to be hard-coded in
// index.html. Safe to re-run — it only seeds when the tables are empty.
//
// The API routes also run this automatically on first request, so running
// this script by hand is optional; it's here mainly for local development
// and for anyone who wants to seed the database before the first deploy.
//
// Usage:
//   vercel env pull .env.local   # pulls DATABASE_URL etc. from the project
//   node --env-file=.env.local scripts/migrate.mjs
// or simply:
//   DATABASE_URL="postgres://..." node scripts/migrate.mjs

import { ensureReady } from "../api/_lib/db.js";

try {
  const result = await ensureReady();
  console.log("Schema is ready.");
  if (result && result.seeded) {
    console.log(
      `Seeded ${result.tenants} tenant(s), ${result.readings} reading(s), ${result.bills} bill(s).`
    );
  } else {
    console.log("Tables already contained data — left as-is.");
  }
  process.exit(0);
} catch (err) {
  console.error("Migration failed:", err.message || err);
  process.exit(1);
}
