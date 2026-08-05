import { ensureReady, query, readingRowToApi } from "../_lib/db.js";

export default async function handler(req, res) {
  try {
    await ensureReady();
    const { id } = req.query;

    if (req.method === "PUT") {
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
        res.status(200).json(readingRowToApi(rows[0]));
      } catch (err) {
        if (err.code === "23505") {
          res.status(409).json({ error: "A reading already exists for that date." });
          return;
        }
        throw err;
      }
      return;
    }

    if (req.method === "DELETE") {
      const { rows } = await query("DELETE FROM readings WHERE id = $1 RETURNING id", [id]);
      if (!rows.length) {
        res.status(404).json({ error: "Reading not found." });
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
