import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { api } from "@/lib/client";
import { CATEGORIES, DailyReport, NewsItem, categoryLabel } from "@/lib/types";
import { getClientToday } from "@/lib/date";

const today = getClientToday();
type QaIssue = {
  level: "严重" | "警告" | "提示";
  message: string;
};

export default function DailyPage() {
  const router = useRouter();
  const [date, setDate] = useState(today);
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("draft");
  const [message, setMessage] = useState("");
  const [pool, setPool] = useState<NewsItem[]>([]);
  const [candidates, setCandidates] = useState<NewsItem[]>([]);
  const [qaIssues, setQaIssues] = useState<QaIssue[] | null>(null);

  useEffect(() => {
    const queryDate = typeof router.query.date === "string" ? router.query.date : today;
    setDate(queryDate);
    load(queryDate).catch(() => undefined);
    loadPool(queryDate).catch(() => undefined);
    loadCandidates(queryDate).catch(() => undefined);
  }, [router.query.date]);

  async function load(reportDate = date) {
    const report = await api<DailyReport | null>(`/api/daily?date=${reportDate}`);
    if (report) {
      setContent(cleanDailyContent(report.content_markdown));
      setStatus(report.status);
      setMessage(`已加载 ${reportDate} 日报。`);
    }
  }

  async function generate() {
    setMessage("正在汇总所选日期当天重点新闻...");
    const result = await api<{ content_markdown: string; selectedCount: number }>("/api/daily/generate", {
      method: "POST",
      body: JSON.stringify({ date })
    });
    setContent(cleanDailyContent(result.content_markdown));
    setStatus("draft");
    setMessage(`已生成草稿，纳入 ${result.selectedCount} 条重点新闻。`);
    await loadPool(date);
    await loadCandidates(date);
  }

  async function loadPool(reportDate = date) {
    setPool(await api<NewsItem[]>(`/api/daily/pool?date=${reportDate}`));
  }

  async function loadCandidates(reportDate = date) {
    setCandidates(await api<NewsItem[]>(`/api/daily/candidates?date=${reportDate}`));
  }

  async function updatePoolOrder(nextPool: NewsItem[]) {
    setPool(nextPool);
    await Promise.all(nextPool.map((item, index) => api<NewsItem>(`/api/news/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({ daily_order: index + 1 })
    })));
  }

  async function movePoolItem(category: string, itemId: number, direction: -1 | 1) {
    const categoryItems = pool.filter((item) => item.category === category);
    const index = categoryItems.findIndex((item) => item.id === itemId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= categoryItems.length) return;
    const reorderedCategoryItems = [...categoryItems];
    [reorderedCategoryItems[index], reorderedCategoryItems[target]] = [reorderedCategoryItems[target], reorderedCategoryItems[index]];
    const next = CATEGORIES.flatMap((currentCategory) => (
      currentCategory === category
        ? reorderedCategoryItems
        : pool.filter((item) => item.category === currentCategory)
    ));
    await updatePoolOrder(next);
  }

  async function removeFromPool(item: NewsItem) {
    await api<NewsItem>(`/api/news/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({ include_in_daily: false, daily_order: 0 })
    });
    setPool(pool.filter((candidate) => candidate.id !== item.id));
    setMessage("已从今日精选池移除。重新生成日报后生效。");
    await loadCandidates();
  }

  async function addCandidate(item: NewsItem, replaced?: NewsItem) {
    if (replaced) {
      await api<NewsItem>(`/api/news/${replaced.id}`, {
        method: "PATCH",
        body: JSON.stringify({ include_in_daily: false, daily_order: 0 })
      });
    }
    const nextOrder = replaced?.daily_order || Math.max(0, ...pool.map((candidate) => candidate.daily_order || 0)) + 1;
    await api<NewsItem>(`/api/news/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({ include_in_daily: true, daily_order: nextOrder })
    });
    setMessage(replaced ? "已替换精选新闻，重新生成日报后生效。" : "已加入精选池，重新生成日报后生效。");
    await loadPool();
    await loadCandidates();
  }

  async function save(nextStatus = status) {
    const cleanedContent = cleanDailyContent(content);
    const report = await api<DailyReport>("/api/daily", {
      method: "POST",
      body: JSON.stringify({ report_date: date, content_markdown: cleanedContent, status: nextStatus })
    });
    setContent(cleanedContent);
    setStatus(report.status);
    setMessage("日报已保存。");
  }

  function copy(format: "markdown" | "text") {
    try {
      const value = format === "markdown" ? content : toPlainText(content);
      if (!value.trim()) {
        setMessage("当前日报内容为空，暂无可复制内容。");
        return;
      }

      const copied = copyToClipboard(value);
      setMessage(copied
        ? (format === "markdown" ? "Markdown 已复制。" : "纯文本已复制。")
        : "复制失败，请先选中编辑框内容后手动复制。"
      );
    } catch {
      setMessage("复制失败，请先选中编辑框内容后手动复制。");
    }
  }

  function exportPdf() {
    if (!content.trim()) {
      setMessage("当前日报内容为空，请先生成或加载日报。");
      return;
    }
    const previousTitle = document.title;
    document.title = `中国电信系统部新闻情报日报-${date}`;
    window.print();
    window.setTimeout(() => {
      document.title = previousTitle;
    }, 500);
  }

  function runQualityCheck() {
    const issues = inspectDailyContent(content, pool);
    setQaIssues(issues);
    setMessage(issues.length ? `质检完成，发现 ${issues.length} 条可检查项。` : "质检完成，未发现明显问题。");
  }

  return (
    <Layout>
      <div className="no-print mb-5 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <div className="mb-2 h-1 w-24 rounded-full tech-divider" />
          <h1 className="tech-title text-2xl font-semibold">日报生成与人工审核</h1>
          <p className="mt-1 text-sm text-muted">默认汇总所选日期当天新闻，生成后可人工编辑、保存、复制或导出 PDF，再手动发送到工作群。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input type="date" className="tech-input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      {message ? <div className="no-print tech-panel-soft mb-4 px-4 py-3 text-sm text-slate-200">{message}</div> : null}
      <div className="no-print mb-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={generate} className="tech-button-primary px-3">生成日报</button>
        <button type="button" onClick={() => save()} className="tech-button-dark px-3">保存日报</button>
        <select className="tech-input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="draft">草稿</option>
          <option value="reviewed">已审核</option>
          <option value="sent_manually">已人工发送</option>
        </select>
        <button type="button" onClick={() => save("reviewed")} className="tech-button-dark px-3">标记已审核</button>
        <button type="button" onClick={() => save("sent_manually")} className="tech-button-red px-3">标记已人工发送</button>
        <button type="button" onClick={() => copy("markdown")} className="tech-button-dark px-3">复制 Markdown</button>
        <button type="button" onClick={() => copy("text")} className="tech-button-dark px-3">复制纯文本</button>
        <button type="button" onClick={exportPdf} className="tech-button-dark px-3">导出 PDF</button>
        <button type="button" onClick={runQualityCheck} className="tech-button-primary px-3">质检日报</button>
      </div>
      {qaIssues ? (
        <section className="no-print tech-panel mb-4 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-ink">日报质检结果</h2>
              <p className="text-xs text-muted">检查重复主题、缺少原文链接、网页导航噪音、栏目完整性和精选池数量。</p>
            </div>
            <button type="button" onClick={() => setQaIssues(null)} className="tech-button-dark px-3">收起</button>
          </div>
          {qaIssues.length ? (
            <div className="grid gap-2 md:grid-cols-2">
              {qaIssues.map((issue, index) => (
                <div
                  key={`${issue.level}-${index}`}
                  className={issue.level === "严重"
                    ? "rounded border border-huawei/45 bg-huawei/10 px-3 py-2 text-sm text-red-50"
                    : issue.level === "警告"
                      ? "rounded border border-amber-400/35 bg-amber-400/10 px-3 py-2 text-sm text-amber-50"
                      : "rounded border border-telecom/35 bg-telecom/10 px-3 py-2 text-sm text-cyan"
                  }
                >
                  <span className="mr-2 font-semibold">[{issue.level}]</span>
                  {issue.message}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded border border-emerald-400/35 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100">
              未发现明显问题，可以继续人工审核重点表述。
            </div>
          )}
        </section>
      ) : null}
      <section className="no-print tech-panel mb-4 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-ink">今日精选池</h2>
            <p className="text-xs text-muted">按 8 个栏目管理已纳入日报的新闻；每个栏目日报最多取前 2 条，调整后重新生成日报生效。</p>
          </div>
          <button type="button" onClick={() => { loadPool(); loadCandidates(); }} className="tech-button-dark px-3">刷新精选池</button>
        </div>
        <div className="grid gap-3 xl:grid-cols-2">
          {CATEGORIES.map((category) => {
            const categoryItems = pool.filter((item) => item.category === category);
            const categoryCandidates = candidates.filter((item) => item.category === category).slice(0, 3);
            return (
              <div key={category} className="rounded border border-line bg-white/[0.03] p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">{categoryLabel(category)}</h3>
                    <p className="text-xs text-muted">已选 {Math.min(categoryItems.length, 2)}/2，超出部分作为替补</p>
                  </div>
                  <a className="tech-link text-xs" href={`/news?category=${encodeURIComponent(category)}&date=${date}`}>去选择</a>
                </div>
                {categoryItems.length ? (
                  <div className="space-y-2">
                    {categoryItems.map((item, index) => (
                      <div key={item.id} className={index < 2 ? "rounded border border-telecom/25 bg-telecom/5 p-2" : "rounded border border-line bg-white/[0.02] p-2 opacity-70"}>
                        <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                          <span className="rounded bg-telecom/15 px-2 py-0.5 text-cyan">{index < 2 ? `日报 ${index + 1}` : `替补 ${index - 1}`}</span>
                          {item.is_china_telecom_related ? <span className="rounded bg-telecom/15 px-2 py-0.5 text-cyan">中国电信</span> : null}
                          {item.is_huawei_related ? <span className="rounded bg-huawei/15 px-2 py-0.5 text-red-100">华为</span> : null}
                        </div>
                        <p className="text-sm font-medium leading-6 text-slate-100">{item.title}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button type="button" onClick={() => movePoolItem(category, item.id, -1)} className="tech-button-dark px-2 py-1 text-xs" disabled={index === 0}>上移</button>
                          <button type="button" onClick={() => movePoolItem(category, item.id, 1)} className="tech-button-dark px-2 py-1 text-xs" disabled={index === categoryItems.length - 1}>下移</button>
                          <button type="button" onClick={() => removeFromPool(item)} className="rounded-md border border-huawei/35 px-2 py-1 text-xs text-red-100 transition hover:bg-huawei/15">移除</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p className="rounded border border-dashed border-line px-3 py-4 text-center text-xs text-muted">本栏目暂无精选新闻</p>}
                <div className="mt-3 border-t border-line pt-3">
                  <p className="mb-2 text-xs font-semibold text-slate-300">推荐候选</p>
                  {categoryCandidates.length ? (
                    <div className="space-y-2">
                      {categoryCandidates.map((item) => (
                        <div key={item.id} className="rounded border border-line bg-[#061521]/70 p-2">
                          <p className="text-xs font-medium leading-5 text-slate-100">{item.title}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {categoryItems.length < 2 ? (
                              <button type="button" onClick={() => addCandidate(item)} className="rounded-md border border-telecom/50 bg-telecom/15 px-2 py-1 text-xs text-cyan transition hover:bg-telecom/25">加入</button>
                            ) : null}
                            {categoryItems.slice(0, 2).map((selected, index) => (
                              <button key={selected.id} type="button" onClick={() => addCandidate(item, selected)} className="tech-button-dark px-2 py-1 text-xs">替换第 {index + 1} 条</button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : <p className="rounded border border-dashed border-line px-3 py-3 text-center text-xs text-muted">暂无候选</p>}
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_430px]">
        <div className="no-print tech-panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-100">人工编辑区</p>
              <p className="text-xs text-muted">支持直接修改 Markdown，保存后进入历史日报。</p>
            </div>
            <span className="rounded bg-telecom/15 px-2 py-1 text-xs text-cyan">Markdown</span>
          </div>
          <textarea
            className="min-h-[660px] w-full resize-y border-0 bg-[#061521]/95 p-5 font-mono text-sm leading-7 text-slate-100 outline-none placeholder:text-muted focus:ring-0"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="点击“生成日报”创建草稿，或从历史日报进入编辑。"
          />
        </div>
        <aside className="print-area tech-panel overflow-hidden lg:sticky lg:top-24 lg:max-h-[760px]">
          <div className="no-print flex items-center justify-between border-b border-line px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-100">微信群预览</p>
              <p className="text-xs text-muted">用于审核阅读节奏和重点是否清楚。</p>
            </div>
            <span className="h-2 w-2 rounded-full bg-huawei shadow-[0_0_14px_rgba(224,30,55,0.9)]" />
          </div>
          <div className="print-content max-h-[700px] overflow-y-auto px-5 py-4">
            {content.trim() ? <ReportPreview content={content} /> : <p className="text-sm text-muted">生成日报后，这里会显示适合群发前审核的阅读预览。</p>}
          </div>
        </aside>
      </section>
    </Layout>
  );
}

function ReportPreview({ content }: { content: string }) {
  const cleanedContent = cleanDailyContent(content);
  const lines = cleanedContent.split("\n");
  return (
    <div className="space-y-2 text-sm leading-7 text-slate-200">
      {lines.map((line, index) => {
        const text = line.trim();
        if (!text) return <div key={index} className="h-2" />;
        if (text.startsWith("# ")) {
          return <h2 key={index} className="mb-4 border-l-2 border-huawei pl-3 text-lg font-semibold text-white">{text.replace(/^#\s+/, "")}</h2>;
        }
        if (text.startsWith("## ")) {
          return <h3 key={index} className="mt-5 border-l-2 border-telecom pl-3 text-base font-semibold text-cyan">{text.replace(/^##\s+/, "")}</h3>;
        }
        if (text.startsWith("- ")) {
          const title = text.replace(/^- /, "");
          const articleUrl = findFollowingArticleUrl(lines, index);
          return (
            <p key={index} className="rounded border border-line bg-white/[0.03] px-3 py-2 text-slate-100">
              {articleUrl ? (
                <a className="tech-link font-medium text-slate-100" href={articleUrl}>
                  {title}
                </a>
              ) : title}
            </p>
          );
        }
        if (text.startsWith("原文：")) {
          const match = text.match(/^原文：\[(.*?)\]\((.*?)\)$/);
          return match ? (
            <p key={index} className="-mt-1 ml-3 border-l border-telecom/50 pl-3 text-xs leading-6">
              原文：
              <a className="screen-link tech-link" href={match[2]}>{match[1]}</a>
              <a className="print-link" href={match[2]}>点击/复制原文：{match[2]}</a>
            </p>
          ) : <p key={index} className="-mt-1 ml-3 border-l border-telecom/50 pl-3 text-xs leading-6 text-slate-300">{text}</p>;
        }
        if (text.startsWith("概括：") || text.startsWith("研判：") || text.startsWith("机会：")) {
          return <p key={index} className="-mt-1 ml-3 border-l border-huawei/50 pl-3 text-xs leading-6 text-slate-300">{text}</p>;
        }
        if (text.startsWith("日期：") || text.startsWith("覆盖范围：")) {
          return <p key={index} className="text-xs text-muted">{text}</p>;
        }
        return <p key={index} className="text-slate-200">{text}</p>;
      })}
    </div>
  );
}

function findFollowingArticleUrl(lines: string[], titleLineIndex: number) {
  for (let index = titleLineIndex + 1; index < lines.length; index += 1) {
    const text = lines[index].trim();
    if (!text) continue;
    if (text.startsWith("- ") || text.startsWith("## ")) return "";
    const match = text.match(/^原文：\[[^\]]+\]\((https?:\/\/[^)]+)\)$/);
    if (match) return match[1];
  }
  return "";
}

function cleanDailyContent(value: string) {
  return value
    .replace(/\n## 今日重点三句话\n[\s\S]*?(?=\n## )/g, "\n")
    .replace(/^## 今日重点三句话\n[\s\S]*?(?=\n## )/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function inspectDailyContent(value: string, pool: NewsItem[]): QaIssue[] {
  const content = cleanDailyContent(value);
  const issues: QaIssue[] = [];
  if (!content.trim()) {
    issues.push({ level: "严重", message: "当前日报内容为空，请先生成日报。" });
  } else {
    for (const category of CATEGORIES) {
      const label = categoryLabel(category);
      if (!content.includes(`、${label}`) && !content.includes(`## ${label}`)) {
        issues.push({ level: "警告", message: `日报中未看到“${label}”栏目。` });
        continue;
      }
      const section = getDailySection(content, label);
      if (section.includes("今日暂无重点信息")) {
        issues.push({ level: "提示", message: `“${label}”栏目暂无重点信息，可确认当天是否确实无可用新闻。` });
      }
    }

    const titles = getDailyTitles(content);
    issues.push(...findSimilarTitleIssues(titles, "日报正文"));

    const newsCount = titles.filter((title) => !title.includes("今日暂无重点信息")).length;
    const linkCount = (content.match(/原文：\[[^\]]+\]\(https?:\/\/[^)]+\)/g) || []).length;
    if (newsCount > 0 && linkCount < newsCount) {
      issues.push({ level: "严重", message: `有 ${newsCount} 条新闻，但只检测到 ${linkCount} 个有效原文链接。` });
    }

    const noisySummary = content.match(/概括：.*?(首页|当前位置|正文|相关阅读|新浪科技>|C114通信网>|频道>).*?(?=\n|$)/);
    if (noisySummary) {
      issues.push({ level: "警告", message: "概括中疑似混入网页导航或面包屑文本，建议回到新闻详情页修正摘要。" });
    }

    const shortSummaries = content
      .split("\n")
      .filter((line) => line.trim().startsWith("概括："))
      .filter((line) => line.replace(/^概括：/, "").trim().length < 24);
    if (shortSummaries.length) {
      issues.push({ level: "提示", message: `有 ${shortSummaries.length} 条概括偏短，建议补充事件背景或业务影响。` });
    }

    const sentiment = getDailySection(content, "舆情和负面信息");
    if (sentiment && !/故障|投诉|处罚|泄露|中断|侵权|造假|争议|监管|安全|攻击|风险|下架|宕机|罚款/.test(sentiment) && !sentiment.includes("今日暂无重点信息")) {
      issues.push({ level: "警告", message: "舆情栏目未检测到明显风险语义，建议确认是否误分到舆情。" });
    }
  }

  for (const category of CATEGORIES) {
    const categoryItems = pool.filter((item) => item.category === category);
    const count = categoryItems.length;
    if (count > 2) {
      issues.push({ level: "提示", message: `精选池“${categoryLabel(category)}”已选 ${count} 条，日报只会采用前 2 条。` });
    }
    issues.push(...findSimilarTitleIssues(categoryItems.map((item) => item.title), `精选池“${categoryLabel(category)}”`));
  }

  return issues;
}

function findSimilarTitleIssues(titles: string[], scope: string): QaIssue[] {
  const issues: QaIssue[] = [];
  const seenExact = new Map<string, string>();
  for (let index = 0; index < titles.length; index += 1) {
    const title = titles[index];
    const key = normalizeForQa(title);
    if (!key || key.length < 8) continue;
    const exact = seenExact.get(key);
    if (exact && exact !== title) {
      issues.push({ level: "警告", message: `${scope}存在重复主题：“${exact}” 与 “${title}”。` });
      continue;
    }
    seenExact.set(key, title);

    for (let nextIndex = index + 1; nextIndex < titles.length; nextIndex += 1) {
      const nextTitle = titles[nextIndex];
      if (areSimilarQaTitles(title, nextTitle)) {
        issues.push({ level: "警告", message: `${scope}存在疑似重复主题：“${title}” 与 “${nextTitle}”。` });
      }
    }
  }
  return dedupeIssues(issues);
}

function getDailySection(content: string, label: string) {
  const escapedLabel = escapeRegExp(label);
  const match = content.match(new RegExp(`\\n##\\s+[^\\n]*${escapedLabel}[^\\n]*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`));
  return match?.[1] || "";
}

function getDailyTitles(content: string) {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.replace(/^- /, "").replace(/\s+（.*?）$/, "").trim())
    .filter((line) => line && !line.includes("今日暂无重点信息"));
}

function normalizeForQa(value: string) {
  return value
    .replace(/Information[:：]\s*/gi, "")
    .replace(/[一二三四]季度|第[一二三四]季度|Q[1-4]/gi, "季度")
    .replace(/升任|出任|担任|获任/g, "任")
    .replace(/成为最年轻的.*$/, "")
    .replace(/[，。、“”‘’：:；;！!？?（）()\[\]【】《》\s-]/g, "")
    .toLowerCase();
}

function areSimilarQaTitles(a: string, b: string) {
  const left = normalizeForQa(a);
  const right = normalizeForQa(b);
  if (!left || !right || left === right) return left === right;
  if ((left.length >= 10 && right.includes(left)) || (right.length >= 10 && left.includes(right))) return true;

  const common = longestCommonSubstringLength(left, right);
  const minLength = Math.min(left.length, right.length);
  if (common >= 10 && common / minLength >= 0.45) return true;

  const overlap = tokenOverlap(left, right);
  return overlap >= 0.6;
}

function longestCommonSubstringLength(a: string, b: string) {
  let best = 0;
  const previous = Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = 0;
    for (let j = 1; j <= b.length; j += 1) {
      const saved = previous[j];
      previous[j] = a[i - 1] === b[j - 1] ? diagonal + 1 : 0;
      if (previous[j] > best) best = previous[j];
      diagonal = saved;
    }
  }
  return best;
}

function tokenOverlap(a: string, b: string) {
  const left = new Set(toBigrams(a));
  const right = new Set(toBigrams(b));
  if (!left.size || !right.size) return 0;
  let common = 0;
  for (const token of left) {
    if (right.has(token)) common += 1;
  }
  return common / Math.min(left.size, right.size);
}

function toBigrams(value: string) {
  const tokens: string[] = [];
  for (let index = 0; index < value.length - 1; index += 1) {
    tokens.push(value.slice(index, index + 2));
  }
  return tokens;
}

function dedupeIssues(issues: QaIssue[]) {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.level}:${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toPlainText(value: string) {
  return cleanDailyContent(value)
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*/g, "")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1：$2")
    .replace(/^- /gm, "• ")
    .trim();
}

function copyToClipboard(value: string) {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}
