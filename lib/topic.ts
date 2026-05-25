import { NewsItem } from "./types";

export type NewsTopicGroup = {
  key: string;
  primary: NewsItem;
  duplicates: NewsItem[];
};

export function groupNewsByTopic(items: NewsItem[]) {
  const groups: NewsTopicGroup[] = [];
  for (const item of items) {
    const group = groups.find((candidate) => isNearDuplicateTopic(candidate.primary, item));
    if (group) {
      group.duplicates.push(item);
    } else {
      groups.push({ key: topicKey(item), primary: item, duplicates: [] });
    }
  }
  return groups;
}

export function isNearDuplicateTopic(a: NewsItem, b: NewsItem) {
  if (a.id === b.id) return true;
  const aPeople = peopleTopicKey(a);
  const bPeople = peopleTopicKey(b);
  if (aPeople && bPeople && aPeople === bPeople) return true;

  const aProduct = productTopicKey(a);
  const bProduct = productTopicKey(b);
  if (aProduct && bProduct && aProduct === bProduct) return true;

  const aTitle = normalizeTopicTitle(a.title);
  const bTitle = normalizeTopicTitle(b.title);
  if (aTitle.includes(bTitle) || bTitle.includes(aTitle)) return Math.min(aTitle.length, bTitle.length) >= 10;
  return titleSimilarity(aTitle, bTitle) >= 0.5 || commonSubstringRatio(aTitle, bTitle) >= 0.45;
}

export function topicKey(item: NewsItem) {
  return peopleTopicKey(item) || productTopicKey(item) || normalizeTopicTitle(item.title);
}

function peopleTopicKey(item: NewsItem) {
  const text = `${item.title} ${item.summary} ${item.event}`;
  const person = text.match(/[\u4e00-\u9fa5]{2,4}/)?.[0] || "";
  const organization = firstMatch(text, [
    /中国电信集团|中国移动集团|中国联通集团|中国广电|华为|中兴|阿里|腾讯|百度|OpenAI|DeepSeek/i,
    /中国电信|中国移动|中国联通/
  ]);
  const isAppointment = /任|升任|出任|获任|担任|履新|任命|副总|总经理|董事长|党组成员|CEO|COO|CFO/i.test(text);
  return person && organization && isAppointment ? `people:${organization}:${person}:appointment` : "";
}

function productTopicKey(item: NewsItem) {
  const text = `${item.title} ${item.summary} ${item.vendors} ${item.keywords}`;
  const financialKey = financialTopicKey(text);
  if (financialKey) return financialKey;

  const vendor = /华为|Huawei/i.test(text) ? "huawei" : /苹果|Apple/i.test(text) ? "apple" : /小米|Xiaomi/i.test(text) ? "xiaomi" : "";
  const product = firstMatch(text, [
    /MatePad\s*Pro\s*Max/i,
    /MatePad\s*Pro/i,
    /MatePad/i,
    /Pura\s*\d+/i,
    /Mate\s*\d+/i,
    /iPhone\s*\d+/i,
    /Gemini\s*\d*(?:\.\d+)?/i,
    /GPT-?\d+(?:\.\d+)?/i,
    /Claude\s*\d*(?:\.\d+)?/i,
    /Kimi/i,
    /DeepSeek/i,
    /通义千问|混元|文心|豆包|鸿蒙办公/
  ]);
  return product ? `${vendor}:${product.toLowerCase().replace(/\s+/g, "")}` : "";
}

function financialTopicKey(text: string) {
  const company = firstMatch(text, [
    /OpenAI/i,
    /Anthropic/i,
    /DeepSeek/i,
    /谷歌|Google/i,
    /阿里|腾讯|百度|字节|月之暗面|智谱/
  ]);
  if (!company) return "";

  const quarter = firstMatch(text, [
    /20\d{2}\s*(?:年)?\s*(?:Q[1-4]|[一二三四]季度|第[一二三四]季度)/i,
    /(?:Q[1-4]|[一二三四]季度|第[一二三四]季度)/i
  ]);
  const isFinancial = /营收|收入|利润|亏损|盈利|财报|业绩|估值|融资|上市|IPO/i.test(text);
  if (!quarter || !isFinancial) return "";
  return `${company.toLowerCase().replace(/\s+/g, "")}:${normalizeQuarter(quarter)}:financial`;
}

function normalizeQuarter(value: string) {
  const lower = value.toLowerCase();
  if (/q1|一季度|第一季度/.test(lower)) return "q1";
  if (/q2|二季度|第二季度/.test(lower)) return "q2";
  if (/q3|三季度|第三季度/.test(lower)) return "q3";
  if (/q4|四季度|第四季度/.test(lower)) return "q4";
  return lower.replace(/\s+/g, "");
}

function firstMatch(value: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[0]) return match[0];
  }
  return "";
}

function normalizeTopicTitle(value: string) {
  return value
    .toLowerCase()
    .replace(/information[:：]\s*/gi, "")
    .replace(/[一二三四]季度|第[一二三四]季度|q[1-4]/gi, "季度")
    .replace(/升任|出任|获任|担任|履新|任命/g, "任")
    .replace(/成为最年轻的.*$/g, "")
    .replace(/[^\p{Script=Han}a-z0-9]+/gu, "");
}

function titleSimilarity(a: string, b: string) {
  if (a.length < 8 || b.length < 8) return 0;
  const aSet = bigramSet(a);
  const bSet = bigramSet(b);
  let intersection = 0;
  for (const value of aSet) {
    if (bSet.has(value)) intersection += 1;
  }
  return intersection / (aSet.size + bSet.size - intersection);
}

function bigramSet(value: string) {
  const set = new Set<string>();
  for (let index = 0; index < value.length - 1; index += 1) {
    set.add(value.slice(index, index + 2));
  }
  return set;
}

function commonSubstringRatio(a: string, b: string) {
  if (a.length < 8 || b.length < 8) return 0;
  const common = longestCommonSubstringLength(a, b);
  return common / Math.min(a.length, b.length);
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
