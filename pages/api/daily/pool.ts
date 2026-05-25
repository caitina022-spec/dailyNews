import type { NextApiRequest, NextApiResponse } from "next";
import { fail, ok } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getShanghaiDayRange, getShanghaiToday } from "@/lib/date";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return fail(res, "Method not allowed", 405);
  try {
    const date = String(req.query.date || getShanghaiToday());
    const { start, end } = getShanghaiDayRange(date);
    const rows = getDb().prepare(`
      SELECT *
      FROM news
      WHERE include_in_daily = 1
        AND published_at BETWEEN ? AND ?
        AND is_publish_time_verified = 1
        AND source IN (SELECT source_name FROM sources WHERE enabled = 1)
      ORDER BY
        CASE WHEN daily_order > 0 THEN 0 ELSE 1 END,
        daily_order ASC,
        is_china_telecom_related DESC,
        importance_score DESC,
        published_at DESC
      LIMIT 80
    `).all(start, end);
    ok(res, rows);
  } catch (error) {
    fail(res, error);
  }
}
