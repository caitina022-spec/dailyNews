import { getDb, nowIso } from "../lib/db";
import { analyzeNewsByRules } from "../lib/rules";
import { NewsItem } from "../lib/types";

const db = getDb();
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : 0;
const rows = db.prepare(`
  SELECT *
  FROM news
  ORDER BY id ASC
  ${limit > 0 ? `LIMIT ${limit}` : ""}
`).all() as NewsItem[];

const update = db.prepare(`
  UPDATE news
  SET category = @category,
      vendors = @vendors,
      keywords = @keywords,
      summary = @summary,
      event = @event,
      related_entities = @related_entities,
      potential_impact = @potential_impact,
      insight_for_china_telecom = @insight_for_china_telecom,
      opportunity_for_huawei = @opportunity_for_huawei,
      suggested_action = @suggested_action,
      importance_score = @importance_score,
      risk_level = @risk_level,
      is_china_telecom_related = @is_china_telecom_related,
      is_huawei_related = @is_huawei_related,
      include_in_daily = @include_in_daily,
      updated_at = @updated_at
  WHERE id = @id
`);

let updated = 0;
for (const row of rows) {
  const analysis = analyzeNewsByRules({
    title: row.title,
    content: row.summary && row.summary !== row.title ? row.summary : ""
  });
  update.run({
    id: row.id,
    category: analysis.category,
    vendors: analysis.vendors.join("、"),
    keywords: analysis.keywords.join("、"),
    summary: analysis.summary,
    event: analysis.event,
    related_entities: analysis.related_entities,
    potential_impact: analysis.potential_impact,
    insight_for_china_telecom: analysis.insight_for_china_telecom,
    opportunity_for_huawei: analysis.opportunity_for_huawei,
    suggested_action: analysis.suggested_action,
    importance_score: analysis.importance_score,
    risk_level: analysis.risk_level,
    is_china_telecom_related: analysis.is_china_telecom_related ? 1 : 0,
    is_huawei_related: analysis.is_huawei_related ? 1 : 0,
    include_in_daily: analysis.include_in_daily ? 1 : 0,
    updated_at: nowIso()
  });
  updated += 1;
}

console.log(`Reanalyzed news=${updated}`);
