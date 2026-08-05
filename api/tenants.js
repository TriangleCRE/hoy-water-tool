import { ensureReady, query, tenantRowToApi } from "./_lib/db.js";

export default async function handler(req, res) {
  try {
    await ensureReady();

    if (req.method === "GET") {
      const { rows } = await query(
        "SELECT * FROM tenants ORDER BY sort_order ASC, name ASC"
      );
      res.status(200).json(rows.map(tenantRowToApi));
      return;
    }

    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
}
