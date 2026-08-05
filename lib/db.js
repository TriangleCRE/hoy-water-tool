// Shared Postgres access for the API routes and the migration script.
//
// Reads the connection string from whichever env var Vercel's Neon
// integration happened to set — never hard-code credentials here.
import pg from "pg";

const { Pool, types } = pg;

// Return DATE columns as plain "YYYY-MM-DD" strings instead of node-postgres's
// default (a JS Date at UTC midnight, which shifts a day in non-UTC runtimes).
types.setTypeParser(types.builtins.DATE, (val) => val);

function getConnectionString() {
  const connectionString =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING;
  if (!connectionString) {
    // Thrown lazily (not at module load) so a missing env var surfaces as a
    // normal JSON error response from the handler's try/catch, not a crash.
    throw new Error(
      "No Postgres connection string found. Set DATABASE_URL (or POSTGRES_URL) " +
        "in the environment — Vercel's Neon integration adds these automatically."
    );
  }
  return connectionString;
}

let pool;
function getPool() {
  if (!pool) {
    const connectionString = getConnectionString();
    // Local/dev Postgres doesn't speak TLS; Neon always does.
    const useSSL = !/localhost|127\.0\.0\.1/.test(connectionString);
    pool = new Pool({
      connectionString,
      ssl: useSSL ? { rejectUnauthorized: false } : false,
      max: 1,
      // Neon's serverless compute can be suspended and take a moment to wake
      // up. Without a bound here, a slow wake-up (or any other connection
      // hiccup) hangs until Vercel's function timeout — several minutes of
      // a blank page that looks exactly like "the site is down" — instead
      // of failing fast with an error the front end can retry.
      connectionTimeoutMillis: 10_000,
    });
  }
  return pool;
}

export async function query(text, params) {
  return getPool().query(text, params);
}

export async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS tenants (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  short TEXT NOT NULL,
  legal TEXT NOT NULL,
  unit TEXT NOT NULL,
  sqft INTEGER NOT NULL,
  billed BOOLEAN NOT NULL DEFAULT TRUE,
  lease_start DATE,
  lease_end DATE,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS readings (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  meters JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS bills (
  id TEXT PRIMARY KEY,
  pstart DATE,
  pend DATE,
  hcf NUMERIC,
  water NUMERIC,
  sewer NUMERIC,
  tax NUMERIC,
  status TEXT NOT NULL DEFAULT 'Draft',
  notes TEXT DEFAULT '',
  prev_id TEXT REFERENCES readings(id) ON DELETE SET NULL,
  curr_id TEXT REFERENCES readings(id) ON DELETE SET NULL
);
`;

let readyPromise = null;

// Arbitrary constant used as a Postgres advisory lock key, scoped to this
// app's schema setup (any int64 works — it just needs to not collide with
// a lock some other process on the same database takes).
const SCHEMA_LOCK_KEY = 727001;
const LOCK_MAX_WAIT_MS = 15_000;
const LOCK_POLL_MS = 200;

// Poll pg_try_advisory_lock instead of blocking on pg_advisory_lock. A plain
// blocking lock has no bound: if whoever's holding it takes unusually long
// (a slow Neon cold-start, a stuck connection), every other request queues
// up behind it for the full serverless timeout — several minutes of a blank
// page. Bounding the wait means a stuck holder degrades to a clear, fast,
// retryable error instead of a platform-level timeout.
async function acquireAdvisoryLock(client, key) {
  const deadline = Date.now() + LOCK_MAX_WAIT_MS;
  for (;;) {
    const { rows } = await client.query("SELECT pg_try_advisory_lock($1) AS locked", [key]);
    if (rows[0].locked) return;
    if (Date.now() >= deadline) {
      throw new Error(
        "Timed out waiting to set up the database (another request may be taking unusually long). Please retry."
      );
    }
    await new Promise((r) => setTimeout(r, LOCK_POLL_MS));
  }
}

// Idempotent — safe to call on every request. Creates the tables (if they
// don't exist yet) and loads the starter data (if the tables are empty).
// `readyPromise` makes repeat calls on the same *warm* serverless instance a
// no-op, but each cold start gets its own fresh module state — so on a burst
// of concurrent requests (e.g. the front end's three parallel page-load
// fetches), several instances can all reach this at once. Plain
// `CREATE TABLE IF NOT EXISTS` isn't safe against that: two connections can
// both see "doesn't exist yet" and race to create it, and the loser crashes
// instead of no-op'ing. A session-level advisory lock serializes them —
// whoever gets there first does the work, the rest wait (bounded — see
// acquireAdvisoryLock), then find the schema (and seed data) already in place.
export function ensureReady() {
  if (!readyPromise) {
    readyPromise = (async () => {
      const client = await getPool().connect();
      let locked = false;
      try {
        await acquireAdvisoryLock(client, SCHEMA_LOCK_KEY);
        locked = true;
        const clientQuery = (text, params) => client.query(text, params);
        await clientQuery(CREATE_TABLES_SQL);
        const { seedIfEmpty } = await import("./seed-data.js");
        return await seedIfEmpty(clientQuery);
      } finally {
        if (locked) {
          // Best-effort: if the connection itself is broken, Postgres drops
          // session-level advisory locks on disconnect anyway.
          await client.query("SELECT pg_advisory_unlock($1)", [SCHEMA_LOCK_KEY]).catch(() => {});
        }
        client.release();
      }
    })().catch((err) => {
      readyPromise = null; // allow retry on next request
      throw err;
    });
  }
  return readyPromise;
}

// ---- row <-> API shape mapping ----
// The front end was written against the original hard-coded object
// shapes (tenant.k, bill.prevId, etc.) — keep those exact field names so
// index.html needed no restructuring beyond swapping localStorage for fetch().

export function tenantRowToApi(r) {
  return {
    k: r.key,
    name: r.name,
    short: r.short,
    legal: r.legal,
    unit: r.unit,
    sqft: r.sqft,
    billed: r.billed,
    leaseStart: r.lease_start ? toISODate(r.lease_start) : null,
    leaseEnd: r.lease_end ? toISODate(r.lease_end) : null,
  };
}

export function readingRowToApi(r) {
  return {
    id: r.id,
    date: toISODate(r.date),
    meters: r.meters || {},
  };
}

export function billRowToApi(r) {
  return {
    id: r.id,
    pstart: r.pstart ? toISODate(r.pstart) : null,
    pend: r.pend ? toISODate(r.pend) : null,
    hcf: numOrNull(r.hcf),
    water: numOrNull(r.water),
    sewer: numOrNull(r.sewer),
    tax: numOrNull(r.tax),
    status: r.status,
    notes: r.notes || "",
    prevId: r.prev_id,
    currId: r.curr_id,
  };
}

function numOrNull(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// DATE columns are configured (above) to come back as "YYYY-MM-DD" strings;
// this just guards against any unexpected shape.
function toISODate(v) {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}
