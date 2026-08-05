import { randomUUID } from "node:crypto";
import { ensureReady, query, billRowToApi } from "../_lib/db.js";

function numOrNull(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default async function handler(req, res) {
  try {
    await ensureReady();

    if (req.method === "GET") {
      const { rows } = await query("SELECT * FROM bills ORDER BY pstart ASC NULLS LAST");
      res.status(200).json(rows.map(billRowToApi));
      return;
    }

    if (req.method === "POST") {
      const b = req.body || {};
      const id = randomUUID();
      const { rows } = await query(
        `INSERT INTO bills (id, pstart, pend, hcf, water, sewer, tax, status, notes, prev_id, curr_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING *`,
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
          b.prevId || null,
          b.currId || null,
        ]
      );
      res.status(201).json(billRowToApi(rows[0]));
      return;
    }

    res.setHeader("Allow", "GET, POST");
    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
}
