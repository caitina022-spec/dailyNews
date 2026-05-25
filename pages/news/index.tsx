import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import NewsCard from "@/components/NewsCard";
import { api } from "@/lib/client";
import { CATEGORIES, NewsItem, categoryLabel } from "@/lib/types";
import { getClientToday } from "@/lib/date";
import { groupNewsByTopic } from "@/lib/topic";

const today = getClientToday();
type Filters = {
  q: string;
  category: string;
  vendor: string;
  date: string;
  importance: string;
  chinaTelecom: boolean;
  huawei: boolean;
  negative: boolean;
  daily: boolean;
};

const defaultFilters: Filters = {
  q: "",
  category: "",
  vendor: "",
  date: today,
  importance: "",
  chinaTelecom: false,
  huawei: false,
  negative: false,
  daily: false
};

export default function NewsListPage() {
  const router = useRouter();
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const topicGroups = groupNewsByTopic(items);

  async function load(nextFilters = filters) {
    setLoading(true);
    const params = new URLSearchParams();
    Object.entries(nextFilters).forEach(([key, value]) => {
      if (typeof value === "boolean") {
        if (value) params.set(key, "1");
      } else if (value) params.set(key, value);
    });
    try {
      setItems(await api<NewsItem[]>(`/api/news?${params.toString()}`));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!router.isReady) return;
    const nextFilters = filtersFromQuery(router.query);
    setFilters(nextFilters);
    load(nextFilters);
  }, [router.isReady, router.query]);

  function submit(event: FormEvent) {
    event.preventDefault();
    load();
  }

  async function toggleDaily(item: NewsItem) {
    const nextInclude = !item.include_in_daily;
    const nextOrder = nextInclude ? Math.max(0, ...items.map((candidate) => candidate.daily_order || 0)) + 1 : 0;
    const updated = await api<NewsItem>(`/api/news/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({ include_in_daily: nextInclude, daily_order: nextOrder })
    });
    setItems((current) => {
      if (filters.daily && !updated.include_in_daily) {
        return current.filter((candidate) => candidate.id !== updated.id);
      }
      return current.map((candidate) => candidate.id === updated.id ? updated : candidate);
    });
  }

  return (
    <Layout>
      <div className="mb-5">
        <div className="mb-2 h-1 w-24 rounded-full tech-divider" />
        <h1 className="tech-title text-2xl font-semibold">新闻列表</h1>
        <p className="mt-1 text-sm text-muted">默认展示所选日期当天新闻，筛选、搜索并检查每条新闻是否纳入日报。</p>
      </div>
      <form onSubmit={submit} className="tech-panel mb-5 p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <input className="tech-input" placeholder="关键词搜索" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
          <select className="tech-input" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
            <option value="">全部栏目</option>
            {CATEGORIES.map((category) => <option key={category} value={category}>{categoryLabel(category)}</option>)}
          </select>
          <input type="date" title="日期，默认展示当天新闻" className="tech-input" value={filters.date} onChange={(e) => setFilters({ ...filters, date: e.target.value })} />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-slate-300">
          <Check label="只看中国电信相关" checked={filters.chinaTelecom} onChange={(v) => setFilters({ ...filters, chinaTelecom: v })} />
          <Check label="只看华为相关" checked={filters.huawei} onChange={(v) => setFilters({ ...filters, huawei: v })} />
          <Check label="只看舆情负面" checked={filters.negative} onChange={(v) => setFilters({ ...filters, negative: v })} />
          <Check label="只看已纳入日报" checked={filters.daily} onChange={(v) => setFilters({ ...filters, daily: v })} />
          <button className="tech-button-primary ml-auto">应用筛选</button>
        </div>
      </form>
      <div className="mb-3 text-sm text-muted">{loading ? "加载中..." : `共 ${items.length} 条，合并为 ${topicGroups.length} 个主题`}</div>
      <div className="space-y-4">
        {topicGroups.map((group) => (
          <NewsCard
            key={group.primary.id}
            item={group.primary}
            duplicates={group.duplicates}
            onToggleDaily={toggleDaily}
          />
        ))}
        {!items.length && !loading ? <div className="tech-panel p-8 text-center text-muted">暂无匹配新闻。</div> : null}
      </div>
    </Layout>
  );
}

function filtersFromQuery(query: Record<string, string | string[] | undefined>): Filters {
  const value = (key: keyof Filters) => {
    const raw = query[key];
    return Array.isArray(raw) ? raw[0] || "" : raw || "";
  };
  return {
    q: value("q"),
    category: value("category"),
    vendor: value("vendor"),
    date: value("date") || today,
    importance: value("importance"),
    chinaTelecom: value("chinaTelecom") === "1",
    huawei: value("huawei") === "1",
    negative: value("negative") === "1",
    daily: value("daily") === "1"
  };
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center gap-2">
      <input type="checkbox" className="rounded border-line bg-[#071827] text-telecom focus:ring-telecom/40" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
