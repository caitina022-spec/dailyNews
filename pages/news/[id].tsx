import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Badge } from "@/components/Badge";
import { api } from "@/lib/client";
import { CATEGORIES, NewsItem, RiskLevel, categoryLabel } from "@/lib/types";

export default function NewsDetailPage() {
  const router = useRouter();
  const [item, setItem] = useState<NewsItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const id = router.query.id;

  async function load() {
    if (!id) return;
    setItem(await api<NewsItem>(`/api/news/${id}`));
  }

  useEffect(() => {
    load();
  }, [id]);

  async function toggleDaily() {
    if (!item) return;
    const updated = await api<NewsItem>(`/api/news/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({ include_in_daily: !item.include_in_daily })
    });
    setItem(updated);
  }

  async function updateItem(patch: Partial<NewsItem>) {
    if (!item) return;
    setSaving(true);
    try {
      const updated = await api<NewsItem>(`/api/news/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify(patch)
      });
      setItem(updated);
      setMessage("人工修正已保存。");
    } finally {
      setSaving(false);
    }
  }

  if (!item) return <Layout><div className="tech-panel p-8 text-muted">加载中...</div></Layout>;

  return (
    <Layout>
      <div className="tech-panel p-6">
        <div className="mb-4 h-1 w-28 rounded-full tech-divider" />
        <div className="mb-4 flex flex-wrap gap-2">
          <Badge tone="blue">{categoryLabel(item.category)}</Badge>
          <Badge tone={item.risk_level === "高" ? "red" : item.risk_level === "中" ? "amber" : "green"}>{item.risk_level}风险</Badge>
          <Badge>重要性 {item.importance_score}/5</Badge>
          {item.is_china_telecom_related ? <Badge tone="blue">中国电信相关</Badge> : null}
          {item.is_huawei_related ? <Badge tone="red">华为相关</Badge> : null}
          {!item.is_publish_time_verified ? <Badge tone="amber">发布时间待核验</Badge> : null}
        </div>
        <h1 className="tech-title text-2xl font-semibold leading-snug">{item.title}</h1>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
          <span>来源：{item.source}</span>
          <span>发布时间：{item.is_publish_time_verified ? new Date(item.published_at).toLocaleString("zh-CN") : "待核验"}</span>
          <a href={item.url} className="tech-link">打开原文</a>
        </div>
        <button onClick={toggleDaily} className={item.include_in_daily ? "tech-button-dark mt-5" : "tech-button-primary mt-5"}>
          {item.include_in_daily ? "取消纳入日报" : "纳入日报"}
        </button>
      </div>
      <section className="mt-5 tech-panel p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-100">人工修正</h2>
            <p className="text-xs text-muted">修正栏目、风险和相关性后，新闻列表、Dashboard 和日报候选会同步生效。</p>
          </div>
          {message ? <span className="text-xs text-cyan">{message}</span> : null}
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-xs text-muted">
            栏目
            <select className="tech-input mt-1 w-full" value={item.category} disabled={saving} onChange={(e) => updateItem({ category: e.target.value as NewsItem["category"] })}>
              {CATEGORIES.map((category) => <option key={category} value={category}>{categoryLabel(category)}</option>)}
            </select>
          </label>
          <label className="text-xs text-muted">
            风险等级
            <select className="tech-input mt-1 w-full" value={item.risk_level} disabled={saving} onChange={(e) => updateItem({ risk_level: e.target.value as RiskLevel })}>
              <option value="低">低</option>
              <option value="中">中</option>
              <option value="高">高</option>
            </select>
          </label>
          <label className="text-xs text-muted">
            重要性
            <select className="tech-input mt-1 w-full" value={item.importance_score} disabled={saving} onChange={(e) => updateItem({ importance_score: Number(e.target.value) })}>
              {[1, 2, 3, 4, 5].map((score) => <option key={score} value={score}>{score} 分</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" className="rounded border-line bg-[#071827] text-telecom focus:ring-telecom/40" checked={Boolean(item.is_china_telecom_related)} disabled={saving} onChange={(e) => updateItem({ is_china_telecom_related: e.target.checked ? 1 : 0 })} />
            中国电信相关
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" className="rounded border-line bg-[#071827] text-telecom focus:ring-telecom/40" checked={Boolean(item.is_huawei_related)} disabled={saving} onChange={(e) => updateItem({ is_huawei_related: e.target.checked ? 1 : 0 })} />
            华为相关
          </label>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-xs text-muted">
            涉及厂商
            <input className="tech-input mt-1 w-full" defaultValue={item.vendors || ""} disabled={saving} onBlur={(e) => updateItem({ vendors: e.target.value })} />
          </label>
          <label className="text-xs text-muted">
            关键词标签
            <input className="tech-input mt-1 w-full" defaultValue={item.keywords || ""} disabled={saving} onBlur={(e) => updateItem({ keywords: e.target.value })} />
          </label>
        </div>
      </section>
      <section className="mt-5 grid gap-5 lg:grid-cols-2">
        <Info title="一句话摘要" value={item.summary} />
        <Info title="涉及厂商 / 对象" value={item.vendors || item.related_entities || "待人工补充"} />
        <Info title="关键词标签" value={item.keywords || "待人工补充"} />
        <Info title="核心事件" value={item.event} />
        <Info title="可能影响" value={item.potential_impact} />
        <Info title="对中国电信的启示" value={item.insight_for_china_telecom} />
        <Info title="对华为中国电信系统部的机会点" value={item.opportunity_for_huawei} />
        <Info title="建议跟进行动" value={item.suggested_action} />
      </section>
    </Layout>
  );
}

function Info({ title, value }: { title: string; value: string }) {
  return (
    <div className="tech-panel-soft p-5">
      <h2 className="mb-2 text-sm font-semibold text-cyan">{title}</h2>
      <p className="leading-7 text-slate-200">{value}</p>
    </div>
  );
}
