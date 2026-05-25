import type { NextApiRequest, NextApiResponse } from "next";
import { getDb } from "@/lib/db";
import { categoryCountsForToday } from "@/lib/daily";
import { fail, ok } from "@/lib/api";
import { getShanghaiDayRange, getShanghaiToday } from "@/lib/date";
import { getC114RollTopNews } from "@/lib/c114Roll";

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    const db = getDb();
    const { start, end } = getShanghaiDayRange(getShanghaiToday());
    const enabledSourceSql = "source IN (SELECT source_name FROM sources WHERE enabled = 1)";
    const count = (where = "1=1") =>
      (db.prepare(`SELECT COUNT(*) as count FROM news WHERE ${where}`).get(start, end) as { count: number }).count;
    const topNews = await getC114RollTopNews(10);
    const latestReport = db.prepare("SELECT * FROM daily_reports ORDER BY report_date DESC, updated_at DESC LIMIT 1").get();
    ok(res, {
      todayTotal: count(`published_at BETWEEN ? AND ? AND is_publish_time_verified = 1 AND ${enabledSourceSql}`),
      chinaTelecomTotal: count(`published_at BETWEEN ? AND ? AND is_publish_time_verified = 1 AND is_china_telecom_related = 1 AND ${enabledSourceSql}`),
      huaweiTotal: count(`published_at BETWEEN ? AND ? AND is_publish_time_verified = 1 AND is_huawei_related = 1 AND ${enabledSourceSql}`),
      highRiskTotal: count(`published_at BETWEEN ? AND ? AND is_publish_time_verified = 1 AND risk_level = '高' AND ${enabledSourceSql}`),
      categoryCounts: categoryCountsForToday(),
      topNews,
      latestReport
    });
  } catch (error) {
    fail(res, error);
  }
}
