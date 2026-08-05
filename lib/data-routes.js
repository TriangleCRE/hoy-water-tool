// Express router for the tenants/readings/bills data API. Mounted at /api in
// server.js, *after* the passcode gate — so, like every other route in this
// app, these require a valid session cookie.
import express from "express";
import { randomUUID } from "node:crypto";
import {
  ensureReady,
  query,
  withTransaction,
  tenantRowToApi,
  readingRowToApi,
  billRowToApi,
} from "./db.js";

const router = express.Router();
router.use(express.json());

function numOrNull(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function asyncRoute(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// Idempotent — creates the schema/seed data on first request, then no-ops.
router.use(
  asyncRoute(async (req, res, next) => {
    await ensureReady();
    next();
  })
);

// ---- tenants ----

router.get(
  "/tenants",
  asyncRoute(async (req, res) => {
    const { rows } = await query("SELECT * FROM tenants ORDER BY sort_order ASC, name ASC");
    res.json(rows.map(tenantRowToApi));
  })
);

// ---- readings ----

router.get(
  "/readings",
  asyncRoute(async (req, res) => {
    const { rows } = await query("SELECT * FROM readings ORDER BY date ASC");
    res.json(rows.map(readingRowToApi));
  })
);

router.post(
  "/readings",
  asyncRoute(async (req, res) => {
    const body = req.body || {};
    const date = body.date;
    const meters = body.meters && typeof body.meters === "object" ? body.meters : {};
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: "A reading date (YYYY-MM-DD) is required." });
      return;
    }
    // Upsert by date — this is what the "Add to log" form and the AI import
    // both do: replace the reading for that date if one exists.
    const { rows } = await query(
      `INSERT INTO readings (id, date, meters)
       VALUES ($1, $2, $3)
       ON CONFLICT (date) DO UPDATE SET meters = EXCLUDED.meters
       RETURNING *`,
      [randomUUID(), date, JSON.stringify(meters)]
    );
    res.json(readingRowToApi(rows[0]));
  })
);

router.put(
  "/readings/:id",
  asyncRoute(async (req, res) => {
    const { id } = req.params;
    const body = req.body || {};
    const date = body.date;
    const meters = body.meters && typeof body.meters === "object" ? body.meters : {};
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: "A reading date (YYYY-MM-DD) is required." });
      return;
    }
    try {
      const { rows } = await query(
        `UPDATE readings SET date = $1, meters = $2 WHERE id = $3 RETURNING *`,
        [date, JSON.stringify(meters), id]
      );
      if (!rows.length) {
        res.status(404).json({ error: "Reading not found." });
        return;
      }
      res.json(readingRowToApi(rows[0]));
    } catch (err) {
      if (err.code === "23505") {
        res.status(409).json({ error: "A reading already exists for that date." });
        return;
      }
      throw err;
    }
  })
);

router.delete(
  "/readings/:id",
  asyncRoute(async (req, res) => {
    const { rows } = await query("DELETE FROM readings WHERE id = $1 RETURNING id", [req.params.id]);
    if (!rows.length) {
      res.status(404).json({ error: "Reading not found." });
      return;
    }
    res.json({ ok: true, id: req.params.id });
  })
);

// ---- bills ----

router.get(
  "/bills",
  asyncRoute(async (req, res) => {
    const { rows } = await query("SELECT * FROM bills ORDER BY pstart ASC NULLS LAST");
    res.json(rows.map(billRowToApi));
  })
);

router.post(
  "/bills",
  asyncRoute(async (req, res) => {
    const b = req.body || {};
    const { rows } = await query(
      `INSERT INTO bills (id, pstart, pend, hcf, water, sewer, tax, status, notes, prev_id, curr_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        randomUUID(),
        b.pstart || null,
        b.pend || null,
        numOrNull(b.hcf),
        numOrNull(b.water),
        numOrNull(b.sewer),
        numOrNull(b.tax),
        b.status || "Draft",
        b.notes || "",
        b.prevId || null,
        b.currId || null,
      ]
    );
    res.status(201).json(billRowToApi(rows[0]));
  })
);

router.put(
  "/bills/:id",
  asyncRoute(async (req, res) => {
    const b = req.body || {};
    const { rows } = await query(
      `UPDATE bills SET
         pstart = $1, pend = $2, hcf = $3, water = $4, sewer = $5, tax = $6,
         status = $7, notes = $8, prev_id = $9, curr_id = $10
       WHERE id = $11
       RETURNING *`,
      [
        b.pstart || null,
        b.pend || null,
        numOrNull(b.hcf),
        numOrNull(b.water),
        numOrNull(b.sewer),
        numOrNull(b.tax),
        b.status || "Draft",
        b.notes || "",
        b.prevId || null,
        b.currId || null,
        req.params.id,
      ]
    );
    if (!rows.length) {
      res.status(404).json({ error: "Bill not found." });
      return;
    }
    res.json(billRowToApi(rows[0]));
  })
);

router.delete(
  "/bills/:id",
  asyncRoute(async (req, res) => {
    const { rows } = await query("DELETE FROM bills WHERE id = $1 RETURNING id", [req.params.id]);
    if (!rows.length) {
      res.status(404).json({ error: "Bill not found." });
      return;
    }
    res.json({ ok: true, id: req.params.id });
  })
);

// ---- bulk import (the "Import (.json)" button) ----

router.post(
  "/import",
  asyncRoute(async (req, res) => {
    const body = req.body || {};
    const readings = Array.isArray(body.readings) ? body.readings : null;
    const bills = Array.isArray(body.bills) ? body.bills : null;
    if (!readings || !bills) {
      res.status(400).json({ error: "Expected { readings: [...], bills: [...] }." });
      return;
    }

    const result = await withTransaction(async (client) => {
      // Bills reference readings, so clear them first, then readings.
      await client.query("DELETE FROM bills");
      await client.query("DELETE FROM readings");

      const readingIds = new Set();
      for (const r of readings) {
        if (!r || !r.date) continue;
        const id = r.id || randomUUID();
        readingIds.add(id);
        await client.query(
          `INSERT INTO readings (id, date, meters) VALUES ($1,$2,$3)
           ON CONFLICT (id) DO UPDATE SET date = EXCLUDED.date, meters = EXCLUDED.meters`,
          [id, r.date, JSON.stringify(r.meters || {})]
        );
      }
      for (const b of bills) {
        if (!b) continue;
        const id = b.id || randomUUID();
        // Drop dangling reading references rather than failing the whole import.
        const prevId = b.prevId && readingIds.has(b.prevId) ? b.prevId : null;
        const currId = b.currId && readingIds.has(b.currId) ? b.currId : null;
        await client.query(
          `INSERT INTO bills (id, pstart, pend, hcf, water, sewer, tax, status, notes, prev_id, curr_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (id) DO UPDATE SET
             pstart=EXCLUDED.pstart, pend=EXCLUDED.pend, hcf=EXCLUDED.hcf,
             water=EXCLUDED.water, sewer=EXCLUDED.sewer, tax=EXCLUDED.tax,
             status=EXCLUDED.status, notes=EXCLUDED.notes,
             prev_id=EXCLUDED.prev_id, curr_id=EXCLUDED.curr_id`,
          [
            id,
            b.pstart || null,
            b.pend || null,
            numOrNull(b.hcf),
            numOrNull(b.water),
            numOrNull(b.sewer),
            numOrNull(b.tax),
            b.status || "Draft",
            b.notes || "",
            prevId,
            currId,
          ]
        );
      }

      const readingRows = (await client.query("SELECT * FROM readings ORDER BY date ASC")).rows;
      const billRows = (await client.query("SELECT * FROM bills ORDER BY pstart ASC NULLS LAST")).rows;
      return {
        readings: readingRows.map(readingRowToApi),
        bills: billRows.map(billRowToApi),
      };
    });

    res.json(result);
  })
);

// Router-local error handler: keep API errors as JSON instead of falling
// through to server.js's plain-text 500.
router.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

export default router;
