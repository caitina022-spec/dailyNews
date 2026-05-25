import { getDb } from "./db";
import { NewsItem } from "./types";

const C114_HOME_URL = "https://www.c114.com.cn/";
const ROLL_URL = "https://www.c114.com.cn/news/roll.asp";

type RollItem = {
  title: string;
  url: string;
  source: string;
  published_at: string;
};

export type DashboardTopNews = {
  id?: number;
  title: string;
  source: string;
  url: string;
  category: string;
  importance_score: number;
  risk_level: string;
  summary: string;
};

export async function getC114RollTopNews(limit = 10): Promise<DashboardTopNews[]> {
  return getC114HomeHotTopNews(limit);
}

export async function getC114HomeHotTopNews(limit = 10): Promise<DashboardTopNews[]> {
  const db = getDb();
  const items = await fetchC114HomeHotItems(limit);

  return items.map((item) => {
    const existing = db.prepare("SELECT * FROM news WHERE url = ?").get(item.url) as NewsItem | undefined;
    if (existing) {
      return {
        id: existing.id,
        title: existing.title,
        source: item.source,
        url: existing.url,
        category: existing.category,
        importance_score: existing.importance_score,
        risk_level: existing.risk_level,
        summary: existing.summary
      };
    }
    return {
      title: item.title,
      source: item.source,
      url: item.url,
      category: inferCategory(item.title, item.url),
      importance_score: 3,
      risk_level: "低",
      summary: item.title
    };
  });
}

async function fetchC114HomeHotItems(limit: number): Promise<RollItem[]> {
  const response = await fetch(C114_HOME_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0 ChinaTelecomIntelPlatform/0.1",
      "Accept": "text/html,*/*"
    }
  });
  if (!response.ok) throw new Error(`C114 home status ${response.status}`);

  const buffer = Buffer.from(await response.arrayBuffer());
  const html = new TextDecoder("gbk").decode(buffer);
  const marker = '<div class="name"><a href="https://www.c114.com.cn/news/roll.asp">热点新闻</a></div>';
  const markerIndex = html.indexOf(marker);
  const hotSection = markerIndex >= 0 ? html.slice(markerIndex, markerIndex + 9000) : "";
  const itemPattern = /<div class="center_list"><a href="([^"]+)">([\s\S]*?)<\/a><\/div>/g;
  const items: RollItem[] = [];
  let match: RegExpExecArray | null;

  while ((match = itemPattern.exec(hotSection))) {
    const block = match[2];
    const url = absoluteUrl(match[1], C114_HOME_URL);
    const title = stripHtml(block.match(/<div class="title">([\s\S]*?)<\/div>/)?.[1] || block.match(/alt="([^"]+)"/)?.[1] || "");
    const dateText = stripHtml(block.match(/<div class="time">([\s\S]*?)<\/div>/)?.[1] || "");
    if (!url || !title) continue;
    items.push({
      title,
      url,
      source: "C114通信网",
      published_at: normalizeC114RollDate(dateText) || new Date().toISOString()
    });
    if (items.length >= limit) break;
  }

  return items;
}

async function fetchC114RollItems(limit: number): Promise<RollItem[]> {
  const response = await fetch(ROLL_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0 ChinaTelecomIntelPlatform/0.1",
      "Accept": "text/html,*/*"
    }
  });
  if (!response.ok) throw new Error(`C114 roll status ${response.status}`);

  const buffer = Buffer.from(await response.arrayBuffer());
  const html = new TextDecoder("gbk").decode(buffer);
  const blocks = html.split('<div class="new_list_c">').slice(1);
  const items: RollItem[] = [];

  for (const block of blocks) {
    const linkMatch = block.match(/<h6><a href="([^"]+)">([\s\S]*?)<\/a><\/h6>/);
    if (!linkMatch) continue;
    const url = absoluteUrl(linkMatch[1], ROLL_URL);
    const title = stripHtml(linkMatch[2]);
    const author = stripHtml(block.match(/<div class="new_list_author[^"]*">([\s\S]*?)<\/div>/)?.[1] || "");
    const dateText = stripHtml(block.match(/<div class="new_list_time[^"]*">([\s\S]*?)<\/div>/)?.[1] || "");
    if (!url || !title) continue;
    items.push({
      title,
      url,
      source: author.split(/\s+/)[0] || "C114通信网",
      published_at: normalizeC114RollDate(dateText) || new Date().toISOString()
    });
    if (items.length >= limit) break;
  }

  return items;
}

function inferCategory(title: string, url: string) {
  const text = `${title} ${url}`;
  if (/移动|联通|电信|运营商|5G-A|卫星直连/.test(text)) return "运营商动态";
  if (/华为|中兴|爱立信|诺基亚|设备|光通信|芯片|服务器/.test(text)) return "CT 设备商动态";
  if (/AI|大模型|OpenAI|Anthropic|Gemini|智能体/.test(text)) return "AI 服务商动态";
  if (/量子|政策|工信部|监管|IPO|融资/.test(text)) return "全球宏观热点";
  return "其他行业热点";
}

function absoluteUrl(url: string, baseUrl = ROLL_URL) {
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return "";
  }
}

function stripHtml(value: string) {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();
}

function normalizeC114RollDate(dateText: string) {
  const text = dateText.replace(/\s+/g, " ").trim();
  const now = getShanghaiParts();
  const timeMatch = text.match(/^(\d{1,2}):(\d{2})$/);
  if (timeMatch) return c114DateToIso(now.month, now.day, Number(timeMatch[1]), Number(timeMatch[2]), now.year);

  const monthDayMatch = text.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (monthDayMatch) return c114DateToIso(Number(monthDayMatch[1]), Number(monthDayMatch[2]), 0, 0);
  const monthDayTimeMatch = text.match(/^(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})$/);
  if (monthDayTimeMatch) {
    return c114DateToIso(
      Number(monthDayTimeMatch[1]),
      Number(monthDayTimeMatch[2]),
      Number(monthDayTimeMatch[3]),
      Number(monthDayTimeMatch[4])
    );
  }
  return undefined;
}

function c114DateToIso(month: number, day: number, hour: number, minute: number, year?: number) {
  const now = getShanghaiParts();
  const normalizedYear = year || (month > now.month || (month === now.month && day > now.day) ? now.year - 1 : now.year);
  return new Date(Date.UTC(normalizedYear, month - 1, day, hour - 8, minute, 0)).toISOString();
}

function getShanghaiParts() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
  return { year: get("year"), month: get("month"), day: get("day") };
}
