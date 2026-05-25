import type { NextApiRequest, NextApiResponse } from "next";
import { fail, ok } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getShanghaiDayRange, getShanghaiToday } from "@/lib/date";
import { groupNewsByTopic } from "@/lib/topic";
import { NewsItem } from "@/lib/types";

type SourceStat = {
  source_name: string;
  enabled: number;
  quality_score: number;
  total_count: number;
  verified_count: number;
  included_count: number;
  duplicate_count: number;
  china_telecom_count: number;
  huawei_count: number;
  high_risk_count: number;
  include_rate: number;
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return fail(res, "Method not allowed", 405);
  try {
    const date = String(req.query.date || getShanghaiToday());
    const { start, end } = getShanghaiDayRange(date);
    const db = getDb();
    const sources = db.prepare("SELECT source_name, enabled, quality_score FROM sources ORDER BY enabled DESC, id ASC").all() as Array<{
      source_name: string;
      enabled: number;
      quality_score: number;
    }>;
    const rows = db.prepare(`
      SELECT n.*, COALESCE(s.enabled, 0) AS source_enabled, COALESCE(s.quality_score, 3) AS source_quality_score
      FROM news n
      LEFT JOIN sources s ON s.source_name = n.source
      WHERE n.published_at BETWEEN ? AND ?
    `).all(start, end) as Array<NewsItem & { source_enabled?: number; source_quality_score?: number }>;

    const bySource = new Map<string, SourceStat>();
    for (const source of sources) {
      bySource.set(source.source_name, {
        source_name: source.source_name,
        enabled: Number(source.enabled || 0),
        quality_score: Number(source.quality_score || 3),
        total_count: 0,
        verified_count: 0,
        included_count: 0,
        duplicate_count: 0,
        china_telecom_count: 0,
        huawei_count: 0,
        high_risk_count: 0,
        include_rate: 0
      });
    }
    for (const item of rows) {
      const stat = bySource.get(item.source) || {
        source_name: item.source,
        enabled: Number(item.source_enabled || 0),
        quality_score: Number(item.source_quality_score || 3),
        total_count: 0,
        verified_count: 0,
        included_count: 0,
        duplicate_count: 0,
        china_telecom_count: 0,
        huawei_count: 0,
        high_risk_count: 0,
        include_rate: 0
      };
      stat.total_count += 1;
      stat.verified_count += item.is_publish_time_verified ? 1 : 0;
      stat.included_count += item.include_in_daily ? 1 : 0;
      stat.china_telecom_count += item.is_china_telecom_related ? 1 : 0;
      stat.huawei_count += item.is_huawei_related ? 1 : 0;
      stat.high_risk_count += item.risk_level === "高" ? 1 : 0;
      bySource.set(item.source, stat);
    }

    const duplicateIds = new Set<number>();
    for (const group of groupNewsByTopic(rows)) {
      for (const duplicate of group.duplicates) duplicateIds.add(duplicate.id);
    }
    for (const item of rows) {
      if (!duplicateIds.has(item.id)) continue;
      const stat = bySource.get(item.source);
      if (stat) stat.duplicate_count += 1;
    }

    const stats = Array.from(bySource.values())
      .map((stat) => ({
        ...stat,
        include_rate: stat.total_count ? Number((stat.included_count / stat.total_count).toFixed(3)) : 0
      }))
      .sort((a, b) =>
        b.enabled - a.enabled
        || b.included_count - a.included_count
        || b.total_count - a.total_count
        || b.quality_score - a.quality_score
      );

    ok(res, stats);
  } catch (error) {
    fail(res, error);
  }
}
