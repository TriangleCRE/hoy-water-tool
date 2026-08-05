// Wholesale replace of readings + bills, used by the "Import (.json)" button
// (the exported file this reads back is the same shape produced by
// /api/readings + /api/bills, wrapped as {readings, bills}).
import { randomUUID } from "node:crypto";
import { ensureReady, withTransaction, readingRowToApi, billRowToApi } from "./_lib/db.js";

function numOrNull(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default async function handler(req, res) {
  try {
    await ensureReady();

    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

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

    res.status(200).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
}
