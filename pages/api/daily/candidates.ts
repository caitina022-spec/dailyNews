import type { NextApiRequest, NextApiResponse } from "next";
import { fail, ok } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getShanghaiDayRange, getShanghaiToday } from "@/lib/date";
import { CATEGORIES, NewsItem } from "@/lib/types";
import { combinedSourceQualityScore } from "@/lib/sourceQuality";
import { groupNewsByTopic } from "@/lib/topic";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return fail(res, "Method not allowed", 405);
  try {
    const date = String(req.query.date || getShanghaiToday());
    const category = String(req.query.category || "");
    const { start, end } = getShanghaiDayRange(date);
    const filters = [
      "n.include_in_daily = 0",
      "n.published_at BETWEEN ? AND ?",
      "n.is_publish_time_verified = 1",
      "n.source IN (SELECT source_name FROM sources WHERE enabled = 1)"
    ];
    const params: unknown[] = [start, end];
    if (category && CATEGORIES.includes(category as typeof CATEGORIES[number])) {
      filters.push("n.category = ?");
      params.push(category);
    }
    const rows = getDb().prepare(`
      SELECT n.*, COALESCE(s.quality_score, 3) AS source_quality_score
      FROM news n
      LEFT JOIN sources s ON s.source_name = n.source
      WHERE ${filters.join(" AND ")}
      ORDER BY n.is_china_telecom_related DESC, n.importance_score DESC, n.published_at DESC
      LIMIT 160
    `).all(...params) as Array<NewsItem & { source_quality_score?: number }>;

    rows.sort((a, b) =>
      Number(b.is_china_telecom_related) - Number(a.is_china_telecom_related)
      || Number(b.is_huawei_related) - Number(a.is_huawei_related)
      || riskScore(b) - riskScore(a)
      || combinedSourceQualityScore(b.source, b.source_quality_score) - combinedSourceQualityScore(a.source, a.source_quality_score)
      || b.importance_score - a.importance_score
      || new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
    );

    const deduped = groupNewsByTopic(rows).map((group) => ({
      ...group.primary,
      duplicate_count: group.duplicates.length
    }));

    ok(res, deduped.slice(0, 80));
  } catch (error) {
    fail(res, error);
  }
}

function riskScore(item: NewsItem) {
  return item.risk_level === "高" ? 3 : item.risk_level === "中" ? 2 : 1;
}
