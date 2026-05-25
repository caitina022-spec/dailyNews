import type { NextApiRequest, NextApiResponse } from "next";
import { getDb } from "@/lib/db";
import { markdownToText, saveDailyReport } from "@/lib/daily";
import { fail, ok } from "@/lib/api";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const db = getDb();
    if (req.method === "GET") {
      const date = String(req.query.date || "");
      const report = date
        ? db.prepare("SELECT * FROM daily_reports WHERE report_date = ?").get(date)
        : db.prepare("SELECT * FROM daily_reports ORDER BY report_date DESC LIMIT 1").get();
      return ok(res, report || null);
    }
    if (req.method === "POST") {
      const body = req.body || {};
      const id = saveDailyReport({
        report_date: body.report_date,
        content_markdown: body.content_markdown,
        content_text: body.content_text || markdownToText(body.content_markdown || ""),
        status: body.status || "draft"
      });
      return ok(res, db.prepare("SELECT * FROM daily_reports WHERE id = ?").get(id));
    }
    fail(res, "Method not allowed", 405);
  } catch (error) {
    fail(res, error);
  }
}
