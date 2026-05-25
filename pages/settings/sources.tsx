import { FormEvent, useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { api } from "@/lib/client";
import { CATEGORIES, SourceConfig, categoryLabel } from "@/lib/types";
import { getClientToday } from "@/lib/date";

const blank = {
  source_name: "",
  source_url: "",
  source_type: "rss",
  category_hint: "运营商动态",
  include_keywords: "",
  exclude_keywords: "",
  quality_score: 3,
  enabled: true
};

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

export default function SourcesPage() {
  const [sources, setSources] = useState<SourceConfig[]>([]);
  const [form, setForm] = useState(blank);
  const [message, setMessage] = useState("");
  const [statsDate, setStatsDate] = useState(getClientToday());
  const [stats, setStats] = useState<SourceStat[]>([]);

  async function load() {
    setSources(await api<SourceConfig[]>("/api/sources"));
  }

  async function loadStats(date = statsDate) {
    setStats(await api<SourceStat[]>(`/api/sources/stats?date=${date}`));
  }

  useEffect(() => {
    load();
    loadStats().catch(() => undefined);
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    await api("/api/sources", { method: "POST", body: JSON.stringify(form) });
    setForm(blank);
    setMessage("新闻源已新增。");
    await load();
    await loadStats();
  }

  async function update(source: SourceConfig, patch: Partial<SourceConfig>) {
    const next = { ...source, ...patch };
    await api(`/api/sources/${source.id}`, { method: "PUT", body: JSON.stringify({ ...next, enabled: Boolean(next.enabled) }) });
    await load();
    await loadStats();
  }

  async function remove(id: number) {
    if (!confirm("确认删除该新闻源？")) return;
    await api(`/api/sources/${id}`, { method: "DELETE" });
    await load();
    await loadStats();
  }

  return (
    <Layout>
      <div className="mb-5">
        <div className="mb-2 h-1 w-24 rounded-full tech-divider" />
        <h1 className="tech-title text-2xl font-semibold">新闻源配置</h1>
        <p className="mt-1 text-sm text-muted">RSS 会按订阅抓取；website 会按已适配站点和通用中文网页列表规则抓取，新增源后需在首页手动抓取一次。</p>
      </div>
      {message ? <div className="tech-panel-soft mb-4 px-4 py-3 text-sm text-slate-200">{message}</div> : null}
      <section className="tech-panel mb-6 p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ink">新闻源质量看板</h2>
            <p className="text-xs text-muted">按所选日期统计抓取量、入选日报量和重复量，用来判断新闻源质量。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              type="date"
              className="tech-input"
              value={statsDate}
              onChange={(event) => {
                setStatsDate(event.target.value);
                loadStats(event.target.value).catch(() => undefined);
              }}
            />
            <button type="button" className="tech-button-dark px-3" onClick={() => loadStats()}>刷新看板</button>
          </div>
        </div>
        {stats.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-line text-xs text-muted">
                <tr>
                  <th className="py-2 pr-4">来源</th>
                  <th className="py-2 pr-4">状态</th>
                  <th className="py-2 pr-4">质量分</th>
                  <th className="py-2 pr-4">抓取</th>
                  <th className="py-2 pr-4">核验</th>
                  <th className="py-2 pr-4">入日报</th>
                  <th className="py-2 pr-4">入选率</th>
                  <th className="py-2 pr-4">重复</th>
                  <th className="py-2 pr-4">中国电信</th>
                  <th className="py-2 pr-4">华为</th>
                  <th className="py-2 pr-4">高风险</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/70">
                {stats.map((stat) => (
                  <tr key={stat.source_name} className="transition hover:bg-white/[0.04]">
                    <td className="py-2 pr-4 font-medium text-slate-100">{stat.source_name}</td>
                    <td className="py-2 pr-4">
                      <span className={stat.enabled ? "rounded bg-telecom/15 px-2 py-1 text-xs text-cyan" : "rounded bg-white/10 px-2 py-1 text-xs text-muted"}>
                        {stat.enabled ? "启用" : "停用"}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-slate-200">{stat.quality_score}</td>
                    <td className="py-2 pr-4 text-slate-200">{stat.total_count}</td>
                    <td className="py-2 pr-4 text-slate-200">{stat.verified_count}</td>
                    <td className="py-2 pr-4 text-cyan">{stat.included_count}</td>
                    <td className="py-2 pr-4 text-slate-200">{Math.round(stat.include_rate * 100)}%</td>
                    <td className={stat.duplicate_count ? "py-2 pr-4 text-amber-200" : "py-2 pr-4 text-slate-400"}>{stat.duplicate_count}</td>
                    <td className="py-2 pr-4 text-slate-200">{stat.china_telecom_count}</td>
                    <td className="py-2 pr-4 text-slate-200">{stat.huawei_count}</td>
                    <td className={stat.high_risk_count ? "py-2 pr-4 text-red-100" : "py-2 pr-4 text-slate-400"}>{stat.high_risk_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="rounded border border-dashed border-line px-4 py-6 text-center text-sm text-muted">所选日期暂无新闻源统计。</p>}
      </section>
      <form onSubmit={submit} className="tech-panel mb-6 p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_1.4fr_0.6fr_0.8fr_0.5fr_auto]">
          <input required className="tech-input" placeholder="source_name" value={form.source_name} onChange={(e) => setForm({ ...form, source_name: e.target.value })} />
          <input required className="tech-input" placeholder="source_url" value={form.source_url} onChange={(e) => setForm({ ...form, source_url: e.target.value })} />
          <select className="tech-input" value={form.source_type} onChange={(e) => setForm({ ...form, source_type: e.target.value })}>
            <option value="rss">rss</option>
            <option value="website">website</option>
          </select>
          <select className="tech-input" value={form.category_hint} onChange={(e) => setForm({ ...form, category_hint: e.target.value })}>
            {CATEGORIES.map((category) => <option key={category} value={category}>{categoryLabel(category)}</option>)}
          </select>
          <input type="number" min={1} max={5} className="tech-input" title="来源质量分，1-5" value={form.quality_score} onChange={(e) => setForm({ ...form, quality_score: Number(e.target.value) })} />
          <button className="tech-button-primary">新增</button>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <input className="tech-input" placeholder="包含关键词，可用逗号分隔；为空则不过滤" value={form.include_keywords} onChange={(e) => setForm({ ...form, include_keywords: e.target.value })} />
          <input className="tech-input" placeholder="排除关键词，可用逗号分隔" value={form.exclude_keywords} onChange={(e) => setForm({ ...form, exclude_keywords: e.target.value })} />
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" className="rounded border-line bg-[#071827] text-telecom focus:ring-telecom/40" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
          启用
        </label>
      </form>
      <div className="space-y-3">
        {sources.map((source) => (
          <div key={source.id} className="tech-panel-soft p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_1.5fr_0.6fr_0.8fr_0.5fr_auto_auto] md:items-center">
              <input className="tech-input" defaultValue={source.source_name} onBlur={(e) => update(source, { source_name: e.target.value })} />
              <input className="tech-input" defaultValue={source.source_url} onBlur={(e) => update(source, { source_url: e.target.value })} />
              <select className="tech-input" value={source.source_type} onChange={(e) => update(source, { source_type: e.target.value as SourceConfig["source_type"] })}>
                <option value="rss">rss</option>
                <option value="website">website</option>
              </select>
              <select className="tech-input" value={source.category_hint} onChange={(e) => update(source, { category_hint: e.target.value as SourceConfig["category_hint"] })}>
                {CATEGORIES.map((category) => <option key={category} value={category}>{categoryLabel(category)}</option>)}
              </select>
              <input type="number" min={1} max={5} className="tech-input" title="来源质量分，1-5" defaultValue={source.quality_score || 3} onBlur={(e) => update(source, { quality_score: Number(e.target.value) })} />
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" className="rounded border-line bg-[#071827] text-telecom focus:ring-telecom/40" checked={Boolean(source.enabled)} onChange={(e) => update(source, { enabled: e.target.checked ? 1 : 0 })} />
                启用
              </label>
              <button onClick={() => remove(source.id)} className="rounded-md border border-huawei/35 px-3 py-2 text-sm text-red-100 transition hover:bg-huawei/15">删除</button>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <input className="tech-input" placeholder="包含关键词" defaultValue={source.include_keywords || ""} onBlur={(e) => update(source, { include_keywords: e.target.value })} />
              <input className="tech-input" placeholder="排除关键词" defaultValue={source.exclude_keywords || ""} onBlur={(e) => update(source, { exclude_keywords: e.target.value })} />
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
