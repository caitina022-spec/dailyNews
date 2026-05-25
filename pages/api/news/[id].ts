import type { NextApiRequest, NextApiResponse } from "next";
import { getDb, nowIso } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { CATEGORIES, RiskLevel } from "@/lib/types";

const RISK_LEVELS: RiskLevel[] = ["低", "中", "高"];

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const db = getDb();
    const id = Number(req.query.id);
    if (req.method === "PATCH") {
      const body = req.body || {};
      if (body.category !== undefined && !CATEGORIES.includes(body.category)) {
        return fail(res, "Invalid category", 400);
      }
      if (body.risk_level !== undefined && !RISK_LEVELS.includes(body.risk_level)) {
        return fail(res, "Invalid risk_level", 400);
      }
      db.prepare(`
        UPDATE news
        SET include_in_daily = COALESCE(?, include_in_daily),
            daily_order = COALESCE(?, daily_order),
            category = COALESCE(?, category),
            risk_level = COALESCE(?, risk_level),
            is_china_telecom_related = COALESCE(?, is_china_telecom_related),
            is_huawei_related = COALESCE(?, is_huawei_related),
            importance_score = COALESCE(?, importance_score),
            vendors = COALESCE(?, vendors),
            keywords = COALESCE(?, keywords),
            updated_at = ?
        WHERE id = ?
      `).run(
        body.include_in_daily === undefined ? null : body.include_in_daily ? 1 : 0,
        body.daily_order === undefined ? null : Number(body.daily_order) || 0,
        body.category === undefined ? null : String(body.category),
        body.risk_level === undefined ? null : String(body.risk_level),
        body.is_china_telecom_related === undefined ? null : body.is_china_telecom_related ? 1 : 0,
        body.is_huawei_related === undefined ? null : body.is_huawei_related ? 1 : 0,
        body.importance_score === undefined ? null : Math.max(1, Math.min(5, Number(body.importance_score) || 3)),
        body.vendors === undefined ? null : String(body.vendors),
        body.keywords === undefined ? null : String(body.keywords),
        nowIso(),
        id
      );
    }
    const item = db.prepare("SELECT * FROM news WHERE id = ?").get(id);
    if (!item) return fail(res, "News not found", 404);
    ok(res, item);
  } catch (error) {
    fail(res, error);
  }
}
