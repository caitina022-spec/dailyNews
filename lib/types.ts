export const CATEGORIES = [
  "全球宏观热点",
  "AI 服务商动态",
  "AI 产品商品",
  "IT 设备商动态",
  "CT 设备商动态",
  "运营商动态",
  "舆情和负面信息",
  "其他行业热点"
] as const;

export type Category = (typeof CATEGORIES)[number];
export const CATEGORY_LABELS: Record<Category, string> = {
  "全球宏观热点": "全球宏观热点",
  "AI 服务商动态": "AI 服务商动态",
  "AI 产品商品": "AI产商品",
  "IT 设备商动态": "IT 设备商动态",
  "CT 设备商动态": "CT 设备商动态",
  "运营商动态": "运营商动态",
  "舆情和负面信息": "舆情和负面信息",
  "其他行业热点": "其他行业热点"
};

export function categoryLabel(category: string) {
  return CATEGORY_LABELS[category as Category] || category;
}

export type RiskLevel = "低" | "中" | "高";
export type SourceType = "rss" | "website";
export type DailyStatus = "draft" | "reviewed" | "sent_manually";

export type NewsItem = {
  id: number;
  title: string;
  source: string;
  url: string;
  published_at: string;
  published_at_source: "source" | "missing";
  is_publish_time_verified: number;
  category: Category;
  vendors: string;
  keywords: string;
  summary: string;
  event: string;
  related_entities: string;
  potential_impact: string;
  insight_for_china_telecom: string;
  opportunity_for_huawei: string;
  suggested_action: string;
  importance_score: number;
  risk_level: RiskLevel;
  is_china_telecom_related: number;
  is_huawei_related: number;
  include_in_daily: number;
  daily_order: number;
  created_at: string;
  updated_at: string;
};

export type SourceConfig = {
  id: number;
  source_name: string;
  source_url: string;
  source_type: SourceType;
  category_hint: Category;
  include_keywords: string;
  exclude_keywords: string;
  quality_score: number;
  enabled: number;
  created_at: string;
  updated_at: string;
};

export type DailyReport = {
  id: number;
  report_date: string;
  title: string;
  content_markdown: string;
  content_text: string;
  status: DailyStatus;
  created_at: string;
  updated_at: string;
};
