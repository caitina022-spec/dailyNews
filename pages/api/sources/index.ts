import type { NextApiRequest, NextApiResponse } from "next";
import { getDb, nowIso } from "@/lib/db";
import { fail, ok } from "@/lib/api";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const db = getDb();
    if (req.method === "GET") {
      return ok(res, db.prepare("SELECT * FROM sources ORDER BY enabled DESC, id ASC").all());
    }
    if (req.method === "POST") {
      const body = req.body || {};
      const result = db.prepare(`
        INSERT INTO sources (source_name, source_url, source_type, category_hint, include_keywords, exclude_keywords, quality_score, enabled, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        nowIso()
      );
      return ok(res, db.prepare("SELECT * FROM sources WHERE id = ?").get(result.lastInsertRowid));
    }
    fail(res, "Method not allowed", 405);
  } catch (error) {
    fail(res, error);
  }
}
