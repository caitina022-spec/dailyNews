import type { NextApiRequest, NextApiResponse } from "next";
import { getDb } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { getShanghaiDayRange, getShanghaiToday } from "@/lib/date";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const db = getDb();
    const filters: string[] = ["source IN (SELECT source_name FROM sources WHERE enabled = 1)"];
    const params: unknown[] = [];
    const q = String(req.query.q || "").trim();
    const category = String(req.query.category || "").trim();
    const vendor = String(req.query.vendor || "").trim();
    const importance = String(req.query.importance || "").trim();
    const date = String(req.query.date || getShanghaiToday()).trim();
    const flagFilters = [
      ["chinaTelecom", "is_china_telecom_related = 1"],
      ["huawei", "is_huawei_related = 1"],
      ["negative", "(category = '舆情和负面信息' OR risk_level IN ('中', '高'))"],
      ["daily", "include_in_daily = 1"]
    ];

    if (q) {
      filters.push("(title LIKE ? OR summary LIKE ? OR keywords LIKE ? OR vendors LIKE ?)");
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (category) {
      filters.push("category = ?");
      params.push(category);
    }
    if (vendor) {
      filters.push("vendors LIKE ?");
      params.push(`%${vendor}%`);
    }
    if (importance) {
      filters.push("importance_score >= ?");
      params.push(Number(importance));
    }
    if (date) {
      const { start, end } = getShanghaiDayRange(date);
      filters.push("published_at BETWEEN ? AND ? AND is_publish_time_verified = 1");
      params.push(start, end);
    }
    for (const [key, sql] of flagFilters) {
      if (req.query[key] === "1") filters.push(sql);
    }
    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const rows = db.prepare(`
      SELECT * FROM news
      ${where}
      ORDER BY published_at DESC, importance_score DESC
      LIMIT 300
    `).all(...params);
    ok(res, rows);
  } catch (error) {
    fail(res, error);
  }
}
