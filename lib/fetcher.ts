import Parser from "rss-parser";
import { getDb, nowIso } from "./db";
import { analyzeNews } from "./rules";
import { SourceConfig } from "./types";

const parser = new Parser({
  timeout: 12000,
  headers: {
    "User-Agent": "ChinaTelecomIntelPlatform/0.1"
  }
});

type FeedLikeItem = {
  title?: string;
  link?: string;
  guid?: string;
  contentSnippet?: string;
  content?: string;
  summary?: string;
  isoDate?: string;
  pubDate?: string;
};

export async function fetchNews() {
  const db = getDb();
  const limit = Number(process.env.FETCH_LIMIT_PER_SOURCE || 20);
  const sources = db
    .prepare("SELECT * FROM sources WHERE enabled = 1 ORDER BY id ASC")
    .all() as SourceConfig[];
  let fetched = 0;
  let inserted = 0;
  const errors: Array<{ source: string; message: string }> = [];
  const sourceStats: Array<{ source: string; fetched: number; inserted: number }> = [];

  for (const source of sources) {
    let sourceFetched = 0;
    let sourceInserted = 0;
    try {
      const items = source.source_type === "rss"
        ? await fetchRssItems(source.source_url)
        : await fetchWebsiteItems(source);
      const sourceLimit = source.source_url.includes("c114.com.cn")
        ? Number(process.env.C114_FETCH_LIMIT_PER_SOURCE || 80)
        : limit;
      for (const item of sortItemsByPublishedAt(items).slice(0, sourceLimit)) {
        fetched += 1;
        sourceFetched += 1;
        const title = item.title?.trim();
        const url = item.link?.trim() || item.guid?.trim();
        if (!title || !url) continue;
        const exists = db.prepare("SELECT id FROM news WHERE url = ?").get(url);
        if (exists) continue;
        const content = item.contentSnippet || item.content || item.summary || "";
        if (!passesSourceKeywordPolicy(source, `${title}\n${content}`)) continue;
        const analysis = await analyzeNews({ title, content, categoryHint: source.category_hint });
        const createdAt = nowIso();
        const publishedAt = normalizeDate(item.isoDate || item.pubDate);
        const isPublishTimeVerified = Boolean(publishedAt);
        db.prepare(`
          INSERT INTO news (
            title, source, url, published_at, published_at_source, is_publish_time_verified,
            category, vendors, keywords, summary, event, related_entities,
            potential_impact, insight_for_china_telecom, opportunity_for_huawei, suggested_action,
            importance_score, risk_level, is_china_telecom_related, is_huawei_related, include_in_daily,
            created_at, updated_at
          ) VALUES (
            @title, @source, @url, @published_at, @published_at_source, @is_publish_time_verified,
            @category, @vendors, @keywords, @summary, @event, @related_entities,
            @potential_impact, @insight_for_china_telecom, @opportunity_for_huawei, @suggested_action,
            @importance_score, @risk_level, @is_china_telecom_related, @is_huawei_related, @include_in_daily,
            @created_at, @updated_at
          )
        `).run({
          title,
          source: source.source_name,
          url,
          published_at: publishedAt || createdAt,
          published_at_source: isPublishTimeVerified ? "source" : "missing",
          is_publish_time_verified: isPublishTimeVerified ? 1 : 0,
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
          created_at: createdAt,
          updated_at: createdAt
        });
        inserted += 1;
        sourceInserted += 1;
      }
    } catch (error) {
      errors.push({ source: source.source_name, message: error instanceof Error ? error.message : String(error) });
    } finally {
      sourceStats.push({ source: source.source_name, fetched: sourceFetched, inserted: sourceInserted });
    }
  }

  return { sources: sources.length, fetched, inserted, errors, sourceStats };
}

function passesSourceKeywordPolicy(source: SourceConfig, text: string) {
  const includes = keywordList(source.include_keywords);
  const excludes = keywordList(source.exclude_keywords);
  if (excludes.some((keyword) => text.toLowerCase().includes(keyword.toLowerCase()))) return false;
  if (!includes.length) return true;
  return includes.some((keyword) => text.toLowerCase().includes(keyword.toLowerCase()));
}

function keywordList(value?: string) {
  return String(value || "")
    .split(/[,\n，、]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function sortItemsByPublishedAt(items: FeedLikeItem[]) {
  return [...items].sort((a, b) => {
    const aTime = Date.parse(a.isoDate || a.pubDate || "");
    const bTime = Date.parse(b.isoDate || b.pubDate || "");
    if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
    if (Number.isNaN(aTime)) return 1;
    if (Number.isNaN(bTime)) return -1;
    return bTime - aTime;
  });
}

async function fetchRssItems(url: string): Promise<FeedLikeItem[]> {
  const xml = await fetchText(url);
  const feed = await parser.parseString(xml);
  return feed.items;
}

async function fetchWebsiteItems(source: SourceConfig): Promise<FeedLikeItem[]> {
  if (source.source_url.includes("c114.com.cn/local") || source.source_url.includes("c114.com.cn/news/")) {
    return enrichC114ItemsWithDetailDates(parseC114NewsList(await fetchText(source.source_url), source.source_url));
  }
  if (source.source_url.includes("c114.com.cn/ai")) {
    const html = await fetchText(source.source_url);
    return enrichC114ItemsWithDetailDates(uniqueItems([...parseC114CloudAi(html, source.source_url), ...parseC114NewsList(html, source.source_url)]));
  }
  return enrichGenericItemsWithDetailDates(parseGenericNewsList(await fetchText(source.source_url), source.source_url));
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 ChinaTelecomIntelPlatform/0.1",
      "Accept": "application/rss+xml, application/xml, text/xml, text/html, */*"
    }
  });
  if (!response.ok) throw new Error(`Status code ${response.status}`);

  const buffer = Buffer.from(await response.arrayBuffer());
  const head = buffer.subarray(0, 300).toString("latin1");
  const contentType = response.headers.get("content-type") || "";
  const declaredEncoding =
    contentType.match(/charset=([^;]+)/i)?.[1] ||
    head.match(/encoding=["']([^"']+)/i)?.[1] ||
    head.match(/charset=([^"'\s>]+)/i)?.[1] ||
    "utf-8";
  const encoding = /gb|big5/i.test(declaredEncoding) ? "gbk" : "utf-8";
  return new TextDecoder(encoding).decode(buffer);
}

function parseC114CloudAi(html: string, pageUrl: string): FeedLikeItem[] {
  const items: FeedLikeItem[] = [];
  const seen = new Set<string>();
  const itemPattern = /<a href="([^"]+)" class="topic-item">([\s\S]*?)<\/a>/g;
  let match: RegExpExecArray | null;

  while ((match = itemPattern.exec(html))) {
    const link = absoluteUrl(match[1], pageUrl);
    const title = stripHtml(match[2].match(/<div class="topic-item-title">([\s\S]*?)<\/div>/)?.[1] || "");
    if (!link || !title || seen.has(link)) continue;
    seen.add(link);
    const summary = stripHtml(match[2].match(/<p>([\s\S]*?)<\/p>/)?.[1] || "");
    const dateText = stripHtml(match[2].match(/<span>(\d{1,2}\/\d{1,2})<\/span>/)?.[1] || "");
    items.push({
      title,
      link,
      guid: link,
      contentSnippet: summary,
      pubDate: normalizeC114Date(dateText)
    });
  }

  return items;
}

function parseC114NewsList(html: string, pageUrl: string): FeedLikeItem[] {
  return uniqueItems([
    ...parseC114NewsTextBlocks(html, pageUrl),
    ...parseC114NewListBlocks(html, pageUrl)
  ]);
}

function parseC114NewsTextBlocks(html: string, pageUrl: string): FeedLikeItem[] {
  const items: FeedLikeItem[] = [];
  const blocks = html.split('<div class="newsText">').slice(1);

  for (const block of blocks) {
    const linkMatch = block.match(/<a href="([^"]+)">([\s\S]*?)<\/a>/);
    if (!linkMatch) continue;
    const link = absoluteUrl(linkMatch[1], pageUrl);
    const title = stripHtml(linkMatch[2]);
    const author = stripHtml(block.match(/<div class="author[^"]*">([\s\S]*?)<\/div>/)?.[1] || "");
    const dateText = stripHtml(block.match(/<div class="time[^"]*">([\s\S]*?)<\/div>/)?.[1] || "");
    if (!link || !title) continue;
    items.push({
      title,
      link,
      guid: link,
      contentSnippet: author,
      pubDate: normalizeC114ListDate(dateText)
    });
  }

  return items;
}

function parseC114NewListBlocks(html: string, pageUrl: string): FeedLikeItem[] {
  const items: FeedLikeItem[] = [];
  const blocks = html.split('<div class="new_list_c">').slice(1);

  for (const block of blocks) {
    const linkMatch = block.match(/<h6><a href="([^"]+)">([\s\S]*?)<\/a><\/h6>/);
    if (!linkMatch) continue;
    const link = absoluteUrl(linkMatch[1], pageUrl);
    const title = stripHtml(linkMatch[2]);
    const summary = stripHtml(block.match(/<p>([\s\S]*?)<\/p>/)?.[1] || "");
    const dateText = stripHtml(block.match(/<div class="new_list_time[^"]*">([\s\S]*?)<\/div>/)?.[1] || "");
    if (!link || !title) continue;
    items.push({
      title,
      link,
      guid: link,
      contentSnippet: summary,
      pubDate: normalizeC114ListDate(dateText)
    });
  }

  return items;
}

function parseGenericNewsList(html: string, pageUrl: string): FeedLikeItem[] {
  const items: FeedLikeItem[] = [];
  const pageHost = safeHost(pageUrl);
  const anchorPattern = /<a\b([^>]*)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = anchorPattern.exec(html))) {
    const link = absoluteUrl(match[2], pageUrl);
    const title = normalizeTitle(stripHtml(match[4]));
    if (!isLikelyNewsLink(link, pageHost) || !isLikelyNewsTitle(title)) continue;

    const context = html.slice(Math.max(0, match.index - 260), Math.min(html.length, anchorPattern.lastIndex + 260));
    items.push({
      title,
      link,
      guid: link,
      contentSnippet: title,
      pubDate: parseGenericDate(`${match[1]} ${match[3]} ${stripHtml(context)}`, link)
    });
  }

  return uniqueItems(items).slice(0, 80);
}

async function enrichC114ItemsWithDetailDates(items: FeedLikeItem[]) {
  const enriched: FeedLikeItem[] = [];

  for (const item of items) {
    if (item.pubDate || item.isoDate || !item.link) {
      enriched.push(item);
      continue;
    }

    try {
      const html = await fetchText(item.link);
      enriched.push({ ...item, pubDate: parseC114DetailDate(html) });
    } catch {
      enriched.push(item);
    }
  }

  return enriched;
}

async function enrichGenericItemsWithDetailDates(items: FeedLikeItem[]) {
  const enriched: FeedLikeItem[] = [];

  for (const item of items.slice(0, 60)) {
    if (item.pubDate || item.isoDate || !item.link) {
      enriched.push(item);
      continue;
    }

    try {
      const html = await fetchText(item.link);
      const date = parseGenericDetailDate(html, item.link);
      const summary = parseMetaContent(html, "description") || item.contentSnippet;
      enriched.push({ ...item, contentSnippet: summary, pubDate: date });
    } catch {
      enriched.push(item);
    }
  }

  return enriched;
}

function parseC114DetailDate(html: string) {
  const dateText = stripHtml(html.match(/<div class="time">([\s\S]*?)<\/div>/)?.[1] || "");
  return normalizeC114ListDate(dateText);
}

function parseGenericDetailDate(html: string, url: string) {
  const metaDate =
    parseMetaContent(html, "article:published_time") ||
    parseMetaContent(html, "pubdate") ||
    parseMetaContent(html, "publishdate") ||
    parseMetaContent(html, "date") ||
    parseMetaContent(html, "weibo: article:create_at") ||
    stripHtml(html.match(/(?:发布时间|发布日期|时间|发表于|发布于)[：:\s]*<\/?[^>]*>\s*([0-9]{4}[-/年.]\d{1,2}[-/月.]\d{1,2}(?:[日\s]+(?:\d{1,2}:\d{2}(?::\d{2})?)?)?)/)?.[1] || "");
  return parseGenericDate(metaDate, url) || parseGenericDate(stripHtml(html.slice(0, 5000)), url);
}

function parseMetaContent(html: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${escaped}["'][^>]*>`, "i")
  ];
  for (const pattern of patterns) {
    const value = html.match(pattern)?.[1];
    if (value) return decodeHtml(value).trim();
  }
  return "";
}

function absoluteUrl(url: string, baseUrl: string) {
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return "";
  }
}

function safeHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isLikelyNewsLink(url: string, pageHost: string) {
  if (!url || /^(javascript|mailto|tel):/i.test(url)) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const host = parsed.hostname.replace(/^www\./, "");
  const sameSite =
    host === pageHost ||
    host.endsWith(`.${pageHost}`) ||
    pageHost.endsWith(`.${host}`) ||
    (pageHost.includes("sina.com.cn") && /sina\.(com\.cn|cn)$/.test(host));
  if (!sameSite) return false;
  return /\/(?:n|p|world|tech|finance|jjxw|roll|article|news|20\d{2})[/?_-]/i.test(parsed.pathname) ||
    /\/20\d{2}[/-]?\d{2}/.test(parsed.pathname) ||
    /\d{5,}/.test(parsed.pathname);
}

function isLikelyNewsTitle(title: string) {
  if (title.length < 8 || title.length > 90) return false;
  if (!/[\u4e00-\u9fa5]/.test(title)) return false;
  if (/^(首页|更多|登录|注册|关于|广告|专题|联系我们|下载|京ICP|京公网)/.test(title)) return false;
  return true;
}

function normalizeTitle(value: string) {
  return value
    .replace(/\d{4}[-/年.]\d{1,2}[-/月.]\d{1,2}.*/, "")
    .replace(/\d{1,2}小时前\s*/, "")
    .replace(/\d{1,2}分钟前\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(value: string) {
  return decodeHtml(value.replace(/<[^>]+>/g, "")).trim();
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ");
}

function normalizeC114Date(dateText: string) {
  const match = dateText.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!match) return undefined;
  return c114DateToIso(Number(match[1]), Number(match[2]), 0, 0);
}

function normalizeC114ListDate(dateText: string) {
  const text = dateText.replace(/\s+/g, " ").trim();
  const timeMatch = text.match(/^(\d{1,2}):(\d{2})$/);
  if (timeMatch) {
    const now = new Date();
    const shanghai = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(now);
    const get = (type: string) => Number(shanghai.find((part) => part.type === type)?.value || 0);
    return c114DateToIso(get("month"), get("day"), Number(timeMatch[1]), Number(timeMatch[2]), get("year"));
  }

  const monthDayMatch = text.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (monthDayMatch) return c114DateToIso(Number(monthDayMatch[1]), Number(monthDayMatch[2]), 0, 0);

  const fullMatch = text.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (fullMatch) {
    return c114DateToIso(
      Number(fullMatch[2]),
      Number(fullMatch[3]),
      Number(fullMatch[4] || 0),
      Number(fullMatch[5] || 0),
      Number(fullMatch[1])
    );
  }

  return undefined;
}

function c114DateToIso(month: number, day: number, hour: number, minute: number, year?: number) {
  if (!year) {
    const shanghai = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date());
    const currentYear = Number(shanghai.find((part) => part.type === "year")?.value || new Date().getUTCFullYear());
    const currentMonth = Number(shanghai.find((part) => part.type === "month")?.value || new Date().getUTCMonth() + 1);
    const currentDay = Number(shanghai.find((part) => part.type === "day")?.value || new Date().getUTCDate());
    year = month > currentMonth || (month === currentMonth && day > currentDay) ? currentYear - 1 : currentYear;
  }
  const date = new Date(Date.UTC(year, month - 1, day, hour - 8, minute, 0));
  return date.toISOString();
}

function parseGenericDate(text: string, url?: string) {
  const combined = `${text || ""} ${url || ""}`.replace(/\s+/g, " ");
  const isoMatch = combined.match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})(?:[日T\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (isoMatch) {
    return shanghaiDateToIso(
      Number(isoMatch[1]),
      Number(isoMatch[2]),
      Number(isoMatch[3]),
      Number(isoMatch[4] || 0),
      Number(isoMatch[5] || 0),
      Number(isoMatch[6] || 0)
    );
  }

  const compactMatch = combined.match(/(?:^|\/)(20\d{2})(\d{2})(\d{2})(?:\/|_|\b)/);
  if (compactMatch) {
    return shanghaiDateToIso(Number(compactMatch[1]), Number(compactMatch[2]), Number(compactMatch[3]), 0, 0, 0);
  }

  const relativeHour = combined.match(/(\d{1,2})\s*小时前/);
  if (relativeHour) return new Date(Date.now() - Number(relativeHour[1]) * 60 * 60 * 1000).toISOString();
  const relativeMinute = combined.match(/(\d{1,2})\s*分钟前/);
  if (relativeMinute) return new Date(Date.now() - Number(relativeMinute[1]) * 60 * 1000).toISOString();

  return undefined;
}

function shanghaiDateToIso(year: number, month: number, day: number, hour: number, minute: number, second: number) {
  const date = new Date(Date.UTC(year, month - 1, day, hour - 8, minute, second));
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function uniqueItems(items: FeedLikeItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.link || item.guid || item.title;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeDate(date?: string) {
  if (!date) return null;
  const parsed = date ? new Date(date) : new Date();
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}
