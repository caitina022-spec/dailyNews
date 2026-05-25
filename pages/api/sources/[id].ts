import type { NextApiRequest, NextApiResponse } from "next";
import { getDb, nowIso } from "@/lib/db";
import { fail, ok } from "@/lib/api";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const db = getDb();
    const id = Number(req.query.id);
    if (req.method === "PUT") {
      const body = req.body || {};
      db.prepare(`
        UPDATE sources
        SET source_name = ?, source_url = ?, source_type = ?, category_hint = ?,
            include_keywords = ?, exclude_keywords = ?, quality_score = ?, enabled = ?, updated_at = ?
        WHERE id = ?
      `).run(
        body.source_name,
        body.source_url,
        body.source_type || "rss",
        body.category_hint,
        body.include_keywords || "",
        body.exclude_keywords || "",
        Number(body.quality_score) || 3,
        body.enabled ? 1 : 0,
        nowIso(),
        id
      );
      return ok(res, db.prepare("SELECT * FROM sources WHERE id = ?").get(id));
    }
    if (req.method === "DELETE") {
      db.prepare("DELETE FROM sources WHERE id = ?").run(id);
      return ok(res, { id });
    }
    fail(res, "Method not allowed", 405);
  } catch (error) {
    fail(res, error);
  }
}
