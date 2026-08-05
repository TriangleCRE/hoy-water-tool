import { ensureReady, query, billRowToApi } from "../_lib/db.js";

function numOrNull(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default async function handler(req, res) {
  try {
    await ensureReady();
    const { id } = req.query;

    if (req.method === "PUT") {
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
          id,
        ]
      );
      if (!rows.length) {
        res.status(404).json({ error: "Bill not found." });
        return;
      }
      res.status(200).json(billRowToApi(rows[0]));
      return;
    }

    if (req.method === "DELETE") {
      const { rows } = await query("DELETE FROM bills WHERE id = $1 RETURNING id", [id]);
      if (!rows.length) {
        res.status(404).json({ error: "Bill not found." });
        return;
      }
      res.status(200).json({ ok: true, id });
      return;
    }

    res.setHeader("Allow", "PUT, DELETE");
    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
}
