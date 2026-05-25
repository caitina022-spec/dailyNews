import type { NextApiRequest, NextApiResponse } from "next";
import { getDb } from "@/lib/db";
import { fail, ok } from "@/lib/api";

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    const rows = getDb().prepare(`
      SELECT id, report_date, title, status, created_at, updated_at
      FROM daily_reports
      ORDER BY report_date DESC, updated_at DESC
      LIMIT 100
    `).all();
    ok(res, rows);
  } catch (error) {
    fail(res, error);
  }
}
