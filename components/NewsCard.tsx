import Link from "next/link";
import { Badge } from "./Badge";
import { NewsItem, categoryLabel } from "@/lib/types";

export default function NewsCard({
  item,
  duplicates = [],
  onToggleDaily
}: {
  item: NewsItem;
  duplicates?: NewsItem[];
  onToggleDaily?: (item: NewsItem) => void | Promise<void>;
}) {
  return (
    <article className="tech-panel group p-4 transition hover:border-telecom/60 hover:shadow-[0_0_28px_rgba(15,124,255,0.16)]">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="blue">{categoryLabel(item.category)}</Badge>
          {duplicates.length ? <Badge tone="amber">同主题 {duplicates.length + 1} 条</Badge> : null}
          {item.is_china_telecom_related ? <Badge tone="blue">中国电信</Badge> : null}
          {item.is_huawei_related ? <Badge tone="red">华为</Badge> : null}
          {item.include_in_daily ? <Badge tone="green">纳入日报</Badge> : null}
          {!item.is_publish_time_verified ? <Badge tone="amber">发布时间待核验</Badge> : null}
        </div>
        <Link href={`/news/${item.id}`} className="text-lg font-semibold leading-snug text-ink transition group-hover:text-white hover:text-cyan">
          {item.title}
        </Link>
        <p className="text-sm leading-6 text-slate-300">{item.summary}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          <span>{item.source}</span>
          <span>{item.is_publish_time_verified ? new Date(item.published_at).toLocaleString("zh-CN") : "发布时间待核验"}</span>
          {item.vendors ? <span>厂商：{item.vendors}</span> : null}
          {item.keywords ? <span>标签：{item.keywords}</span> : null}
          <a href={item.url} className="tech-link">
            原文链接
          </a>
          {onToggleDaily ? (
            <button
              type="button"
              onClick={() => onToggleDaily(item)}
              className={item.include_in_daily ? "tech-button-dark px-2 py-1 text-xs" : "rounded-md border border-telecom/50 bg-telecom/15 px-2 py-1 text-xs text-cyan transition hover:border-telecom hover:bg-telecom/25"}
            >
              {item.include_in_daily ? "移出日报" : "纳入日报"}
            </button>
          ) : null}
        </div>
        {duplicates.length ? (
          <div className="rounded border border-line bg-white/[0.03] px-3 py-2 text-xs text-muted">
            <div className="mb-1 text-slate-300">同主题来源</div>
            <div className="space-y-1">
              {duplicates.slice(0, 4).map((duplicate) => (
                <a key={duplicate.id} href={duplicate.url} className="block tech-link" target="_blank" rel="noreferrer">
                  {duplicate.source}：{duplicate.title}
                </a>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}
