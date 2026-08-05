import { randomUUID } from "node:crypto";
import { ensureReady, query, readingRowToApi } from "../_lib/db.js";

export default async function handler(req, res) {
  try {
    await ensureReady();

    if (req.method === "GET") {
      const { rows } = await query("SELECT * FROM readings ORDER BY date ASC");
      res.status(200).json(rows.map(readingRowToApi));
      return;
    }

    if (req.method === "POST") {
      const body = req.body || {};
      const date = body.date;
      const meters = body.meters && typeof body.meters === "object" ? body.meters : {};
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        res.status(400).json({ error: "A reading date (YYYY-MM-DD) is required." });
        return;
      }
      // Upsert by date — this is what the "Add to log" form and the AI
      // import both do: replace the reading for that date if one exists.
      const { rows } = await query(
        `INSERT INTO readings (id, date, meters)
         VALUES ($1, $2, $3)
         ON CONFLICT (date) DO UPDATE SET meters = EXCLUDED.meters
         RETURNING *`,
        [randomUUID(), date, JSON.stringify(meters)]
      );
      res.status(200).json(readingRowToApi(rows[0]));
      return;
    }

    res.setHeader("Allow", "GET, POST");
    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
}
