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

// Idempotent — safe to call on every request. Creates the tables (if they
// don't exist yet) and loads the starter data (if the tables are empty).
// Only actually touches the database the first time a given serverless
// instance runs it; later calls on the same warm instance are a no-op.
export function ensureReady() {
  if (!readyPromise) {
    readyPromise = (async () => {
      await query(CREATE_TABLES_SQL);
      const { seedIfEmpty } = await import("./seed-data.js");
      return seedIfEmpty(query);
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
