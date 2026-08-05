// The data that used to be hard-coded at the top of index.html (TENANTS,
// and the seed()'s starter readings/bills). Used by both the migration
// script (scripts/migrate.mjs) and the API's own auto-seed-on-first-run.

export const TENANTS = [
  { key: "pizza", name: "Pizza Hut", short: "Pizza Hut", legal: "Pizza Hut (Ayvaz Pizza LLC)", unit: "Ste C", sqft: 1600, billed: true, leaseStart: null, leaseEnd: null },
  { key: "amed", name: "Amedisys", short: "Amedisys", legal: "Amedisys Home Health Care, Inc. of Virginia", unit: "Ste B", sqft: 2500, billed: true, leaseStart: null, leaseEnd: null },
  { key: "trop", name: "Tropical Smoothie", short: "Tropical", legal: "Tropical Smoothie - Staunton", unit: "Ste A1", sqft: 1200, billed: true, leaseStart: "2025-06-06", leaseEnd: null },
  { key: "lend", name: "Lendmark", short: "Lendmark", legal: "Lendmark Financial Services, Inc. Branch 409", unit: "Ste A2", sqft: 1700, billed: true, leaseStart: null, leaseEnd: null },
  { key: "univ", name: "University Cleaners", short: "Univ Clnrs", legal: "University Cleaners LLC", unit: "Ste D", sqft: 1640, billed: true, leaseStart: null, leaseEnd: null },
  { key: "vac", name: "Vacant", short: "Vacant", legal: "Vacant", unit: "Ste 106", sqft: 1200, billed: false, leaseStart: null, leaseEnd: null },
];

export const READINGS = [
  { id: "seed-r01", date: "2024-11-12", meters: { univ: 3153800, pizza: 790200, amed: 228700, lend: 148200, trop: null, vac: 4989 } },
  { id: "seed-r02", date: "2025-01-28", meters: { univ: 3154100, pizza: 965600, amed: 232500, lend: 148700, trop: null, vac: 4989 } },
  { id: "seed-r03", date: "2025-06-15", meters: { univ: 3155100, pizza: 1101500, amed: 254500, lend: 150800, trop: null, vac: null } },
  { id: "seed-r04", date: "2025-08-13", meters: { univ: 3155500, pizza: 1117900, amed: 258500, lend: 151800, trop: null, vac: 5049 } },
  { id: "seed-r05", date: "2025-12-11", meters: { univ: 3156900, pizza: 1139300, amed: 267400, lend: 153600, trop: null, vac: null } },
  { id: "seed-r06", date: "2026-01-12", meters: { univ: 3157700, pizza: 1145000, amed: 269500, lend: 154100, trop: 8080, vac: null } },
  { id: "seed-r07", date: "2026-02-04", meters: { univ: 3157900, pizza: 1149200, amed: 271000, lend: 154400, trop: 8539, vac: null } },
  { id: "seed-r08", date: "2026-03-02", meters: { univ: 3158100, pizza: 1154700, amed: 273300, lend: 154800, trop: 9155, vac: null } },
  { id: "seed-r09", date: "2026-04-03", meters: { univ: 3158500, pizza: 1160700, amed: 275600, lend: 155300, trop: 10058, vac: null } },
  { id: "seed-r10", date: "2026-05-01", meters: { univ: 3158700, pizza: 1166500, amed: 277400, lend: 155800, trop: 11106, vac: 0 } },
  { id: "seed-r11", date: "2026-06-15", meters: { univ: 3161700, pizza: 1178000, amed: 280400, lend: 156700, trop: 12980, vac: null } },
];

export const BILLS = [
  { id: "seed-b01", pstart: "2024-11-12", pend: "2025-01-13", hcf: 204, water: 828.24, sewer: 1142.40, tax: 40, status: "Draft", notes: "City LEAK notice - spike ran through Pizza Hut; confirm before invoicing.", prevId: null, currId: null },
  { id: "seed-b02", pstart: "2025-01-13", pend: "2025-03-11", hcf: 164, water: 665.84, sewer: 918.40, tax: 40, status: "Draft", notes: "City LEAK notice - confirm before invoicing. Per LeighAnn (8/5/26): 2025 was billed to tenants in the old/legacy format because too many meter reads were missing this year — this submeter split is reference only, not what actually went out.", prevId: null, currId: null },
  { id: "seed-b03", pstart: "2025-03-11", pend: "2025-05-12", hcf: 100, water: 406.00, sewer: 560.00, tax: 40, status: "Draft", notes: "Per LeighAnn (8/5/26): 2025 was billed to tenants in the old/legacy format because too many meter reads were missing this year — this submeter split is reference only, not what actually went out.", prevId: null, currId: null },
  { id: "seed-b04", pstart: "2025-05-12", pend: "2025-07-15", hcf: 53, water: 215.18, sewer: 296.80, tax: 40, status: "Draft", notes: "Per LeighAnn (8/5/26): 2025 was billed to tenants in the old/legacy format because too many meter reads were missing this year — this submeter split is reference only, not what actually went out.", prevId: null, currId: null },
  { id: "seed-b05", pstart: "2025-07-15", pend: "2025-09-15", hcf: 53, water: 215.18, sewer: 296.80, tax: 40, status: "Draft", notes: "Per LeighAnn (8/5/26): 2025 was billed to tenants in the old/legacy format because too many meter reads were missing this year — this submeter split is reference only, not what actually went out.", prevId: null, currId: null },
  { id: "seed-b06", pstart: "2025-09-15", pend: "2025-11-10", hcf: 43, water: 174.58, sewer: 240.80, tax: 34.92, status: "Draft", notes: "Per LeighAnn (8/5/26): 2025 was billed to tenants in the old/legacy format because too many meter reads were missing this year — this submeter split is reference only, not what actually went out.", prevId: null, currId: null },
  { id: "seed-b07", pstart: "2025-11-10", pend: "2026-01-09", hcf: 45, water: 182.70, sewer: 252.00, tax: 36.54, status: "Draft", notes: "Per LeighAnn (8/5/26): 2025 was billed to tenants in the old/legacy format because too many meter reads were missing this year — this submeter split is reference only, not what actually went out.", prevId: null, currId: null },
  { id: "seed-b08", pstart: "2026-01-09", pend: "2026-03-10", hcf: 45, water: 182.70, sewer: 252.00, tax: 36.54, status: "Draft", notes: "", prevId: null, currId: null },
  { id: "seed-b09", pstart: "2026-03-10", pend: "2026-05-11", hcf: 57, water: 231.42, sewer: 319.20, tax: 40, status: "Draft", notes: "", prevId: null, currId: null },
];

// Runs inside an existing pg client/pool. Only inserts when the tenants
// table is empty, so it's safe to call unconditionally on every cold start
// and by the standalone migrate script alike.
export async function seedIfEmpty(query) {
  const { rows } = await query("SELECT COUNT(*)::int AS n FROM tenants");
  if (rows[0].n > 0) return { seeded: false };

  for (let i = 0; i < TENANTS.length; i++) {
    const t = TENANTS[i];
    await query(
      `INSERT INTO tenants (key, name, short, legal, unit, sqft, billed, lease_start, lease_end, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (key) DO NOTHING`,
      [t.key, t.name, t.short, t.legal, t.unit, t.sqft, t.billed, t.leaseStart, t.leaseEnd, i]
    );
  }
  for (const r of READINGS) {
    await query(
      `INSERT INTO readings (id, date, meters) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`,
      [r.id, r.date, JSON.stringify(r.meters)]
    );
  }
  for (const b of BILLS) {
    await query(
      `INSERT INTO bills (id, pstart, pend, hcf, water, sewer, tax, status, notes, prev_id, curr_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (id) DO NOTHING`,
      [b.id, b.pstart, b.pend, b.hcf, b.water, b.sewer, b.tax, b.status, b.notes, b.prevId, b.currId]
    );
  }
  return { seeded: true, tenants: TENANTS.length, readings: READINGS.length, bills: BILLS.length };
}
