import { useEffect, useState } from "react";
import Link from "next/link";
import Layout from "@/components/Layout";
import { Badge } from "@/components/Badge";
import { api } from "@/lib/client";
import { getClientToday } from "@/lib/date";
import { categoryLabel } from "@/lib/types";

type Dashboard = {
  todayTotal: number;
  chinaTelecomTotal: number;
  huaweiTotal: number;
  highRiskTotal: number;
  categoryCounts: Array<{ category: string; count: number }>;
  topNews: Array<{ id?: number; title: string; source: string; url: string; category: string; importance_score: number; risk_level: string; summary: string }>;
  latestReport?: { report_date: string; status: string; updated_at: string };
};

export default function Home() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [message, setMessage] = useState("");

  const load = () => api<Dashboard>("/api/dashboard").then(setData);
  useEffect(() => {
    load().catch((error) => setMessage(error.message));
  }, []);

  async function fetchNews() {
    setMessage("正在抓取新闻...");
    const result = await api<{ inserted: number; fetched: number; errors: unknown[]; sourceStats?: Array<{ source: string; fetched: number; inserted: number }> }>("/api/fetch", { method: "POST" });
    const emptySources = result.sourceStats?.filter((item) => item.fetched === 0).map((item) => item.source).slice(0, 4) || [];
    setMessage(`抓取完成：读取 ${result.fetched} 条，新增 ${result.inserted} 条。${emptySources.length ? `未抓到内容的源：${emptySources.join("、")}。` : ""}${result.errors.length ? "部分源失败，请到新闻源页检查。" : ""}`);
    await load();
  }

  async function generateDaily() {
    const today = getClientToday();
    setMessage("正在生成今日日报...");
    await api("/api/daily/generate", { method: "POST", body: JSON.stringify({ date: today }) });
    setMessage("日报草稿已生成，可到日报页面编辑保存。");
  }

  return (
    <Layout>
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <div className="mb-2 h-1 w-28 rounded-full tech-divider" />
          <h1 className="tech-title text-3xl font-semibold tracking-wide">今日情报概览</h1>
          <p className="mt-1 text-sm text-muted">面向华为中国电信系统部的公开新闻采集、研判与日报工作台。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={fetchNews} className="tech-button-primary">手动抓取新闻</button>
          <Link href="/daily" onClick={generateDaily} className="tech-button-dark">生成今日日报</Link>
        </div>
      </div>
      {message ? <div className="tech-panel-soft mb-4 px-4 py-3 text-sm text-slate-200">{message}</div> : null}
      <section className="grid gap-4 md:grid-cols-4">
        <Metric href="/news" label="今日新闻总数" value={data?.todayTotal ?? 0} tone="blue" />
        <Metric href="/news?chinaTelecom=1" label="中国电信相关新闻" value={data?.chinaTelecomTotal ?? 0} tone="blue" />
        <Metric href="/news?huawei=1" label="华为相关新闻" value={data?.huaweiTotal ?? 0} tone="red" />
        <Metric label="高风险舆情" value={data?.highRiskTotal ?? 0} tone="red" />
      </section>
      <section className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <div className="tech-panel p-5">
          <h2 className="mb-4 text-lg font-semibold text-ink">今日重点 Top 10 新闻</h2>
          <div className="space-y-4">
            {data?.topNews?.length ? data.topNews.map((item) => (
              <TopNewsItem key={item.id || item.url} item={item} />
            )) : <p className="text-sm text-muted">暂无今日新闻，先手动抓取一次。</p>}
          </div>
        </div>
        <aside className="space-y-6">
          <div className="tech-panel p-5">
            <h2 className="mb-4 text-lg font-semibold text-ink">各栏目新闻数量</h2>
            <div className="space-y-3">
              {data?.categoryCounts?.map((item) => (
                <Link
                  key={item.category}
                  href={`/news?category=${encodeURIComponent(item.category)}`}
                  className="flex items-center justify-between rounded border border-transparent px-2 py-1 text-sm text-slate-300 transition hover:border-telecom/40 hover:bg-telecom/10 hover:text-white"
                >
                  <span>{categoryLabel(item.category)}</span>
                  <span className="font-semibold text-cyan">{item.count}</span>
                </Link>
              ))}
            </div>
          </div>
          <div className="tech-panel p-5">
            <h2 className="mb-3 text-lg font-semibold text-ink">最近生成的日报</h2>
            {data?.latestReport ? (
              <Link href={`/daily?date=${data.latestReport.report_date}`} className="block text-sm text-slate-300 hover:text-cyan">
                <div className="font-medium text-ink">{data.latestReport.report_date}</div>
                <div className="mt-1 text-muted">状态：{data.latestReport.status}</div>
              </Link>
            ) : <p className="text-sm text-muted">暂无日报。</p>}
          </div>
        </aside>
      </section>
    </Layout>
  );
}

function TopNewsItem({ item }: { item: Dashboard["topNews"][number] }) {
  const content = (
    <>
      <div className="mb-2 flex flex-wrap gap-2">
        <Badge tone="blue">{categoryLabel(item.category)}</Badge>
      </div>
      <p className="font-medium text-ink hover:text-cyan">{item.title}</p>
      <p className="mt-1 text-sm text-muted">{item.source}</p>
    </>
  );
  const className = "relative block border-b border-line pb-3 pl-4 transition before:absolute before:left-0 before:top-1 before:h-2 before:w-2 before:rounded-full before:bg-huawei before:shadow-[0_0_14px_rgba(226,43,69,0.7)] hover:border-telecom/50 last:border-0";
  return <a href={item.url} className={className}>{content}</a>;
}

function Metric({ label, value, href, tone }: { label: string; value: number; href?: string; tone: "blue" | "red" }) {
  const accent = tone === "red" ? "text-huawei drop-shadow-[0_0_18px_rgba(226,43,69,0.55)]" : "text-cyan drop-shadow-[0_0_18px_rgba(35,217,255,0.5)]";
  const line = tone === "red" ? "bg-huawei" : "bg-telecom";
  const content = (
    <>
      <div className={`mb-4 h-1 w-12 rounded-full ${line}`} />
      <div className="text-sm text-muted">{label}</div>
      <div className={`mt-3 text-3xl font-semibold ${accent}`}>{value}</div>
    </>
  );
  const className = "tech-panel p-5";
  if (!href) return <div className={className}>{content}</div>;
  return <Link href={href} className={`${className} block transition hover:border-telecom/60 hover:shadow-[0_0_26px_rgba(15,124,255,0.18)]`}>{content}</Link>;
}
