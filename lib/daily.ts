import { getDb, nowIso } from "./db";
import { CATEGORIES, NewsItem, categoryLabel } from "./types";
import { getShanghaiDayRange, getShanghaiToday } from "./date";
import { sourceQualityScore } from "./sourceQuality";
import { groupNewsByTopic, isNearDuplicateTopic } from "./topic";

const SECTION_NUMBERS = ["一", "二", "三", "四", "五", "六", "七", "八"];

export async function generateDailyReport(date: string) {
  const db = getDb();
  const { start, end } = getShanghaiDayRange(date);
  const news = db.prepare(`
    SELECT * FROM news
    WHERE published_at BETWEEN ? AND ?
      AND is_publish_time_verified = 1
      AND source IN (SELECT source_name FROM sources WHERE enabled = 1)
    ORDER BY
      include_in_daily DESC,
      CASE WHEN daily_order > 0 THEN 0 ELSE 1 END,
      daily_order ASC,
      is_china_telecom_related DESC,
      risk_level DESC,
      importance_score DESC,
      published_at DESC
    LIMIT 300
  `).all(start, end) as NewsItem[];
  const rankedNews = news.sort(compareNewsForDaily);
  mergeSelectedDuplicates(db, rankedNews);

  const reportGroups = CATEGORIES.map((category) => {
    const categoryNews = groupNewsByTopic(rankedNews.filter((item) => item.category === category)).map((group) => group.primary);
    return {
      category,
      items: fillSelectedNews(
        categoryNews.filter((item) => item.include_in_daily || item.importance_score >= 4 || item.risk_level === "高" || item.is_china_telecom_related),
        categoryNews,
        2,
        2
      )
    };
  });
  const reportItems = reportGroups.flatMap((group) => group.items);
  const articleSummaries = await loadArticleSummaries(reportItems);

  const title = "中国电信系统部新闻情报日报";
  const lines = [
    `# ${title}`,
    "",
    `日期：${date}`,
    `覆盖范围：${date}`,
    "",
    ...reportGroups.flatMap((group, index) => [
      `## ${SECTION_NUMBERS[index]}、${categoryLabel(group.category)}`,
      briefingSection(group.items, articleSummaries),
      ""
    ]),
    ""
  ];

  const content_markdown = lines.join("\n");
  const content_text = markdownToText(content_markdown);
  return { title, content_markdown, content_text, selectedCount: reportItems.length };
}

function mergeSelectedDuplicates(db: ReturnType<typeof getDb>, rankedNews: NewsItem[]) {
  for (const group of groupNewsByTopic(rankedNews)) {
    const duplicateIds = group.duplicates
      .filter((item) => item.include_in_daily || item.daily_order > 0)
      .map((item) => item.id);
    if (!duplicateIds.length) continue;
    const placeholders = duplicateIds.map(() => "?").join(",");
    db.prepare(`
      UPDATE news
      SET include_in_daily = 0,
          daily_order = 0,
          updated_at = ?
      WHERE id IN (${placeholders})
    `).run(nowIso(), ...duplicateIds);
  }
}

function compareNewsForDaily(a: NewsItem, b: NewsItem) {
  return Number(b.include_in_daily) - Number(a.include_in_daily)
    || manualOrderScore(a) - manualOrderScore(b)
    || Number(b.is_china_telecom_related) - Number(a.is_china_telecom_related)
    || riskScore(b) - riskScore(a)
    || sourceQualityScore(b.source) - sourceQualityScore(a.source)
    || b.importance_score - a.importance_score
    || new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
}

function manualOrderScore(item: NewsItem) {
  return item.daily_order > 0 ? item.daily_order : Number.MAX_SAFE_INTEGER;
}

function riskScore(item: NewsItem) {
  return item.risk_level === "高" ? 3 : item.risk_level === "中" ? 2 : 1;
}

function fillSelectedNews(priority: NewsItem[], allNews: NewsItem[], max: number, min: number) {
  const selected: NewsItem[] = [];
  const seen = new Set<number>();
  const seenTitles = new Set<string>();
  const push = (item: NewsItem) => {
    const titleKey = normalizeDailyTitle(item.title);
    if (seen.has(item.id) || seenTitles.has(titleKey) || selected.length >= max || selected.some((existing) => isNearDuplicateNews(existing, item))) return;
    seen.add(item.id);
    seenTitles.add(titleKey);
    selected.push(item);
  };

  priority.forEach(push);
  if (selected.length < min) allNews.forEach(push);
  return selected;
}

function isNearDuplicateNews(a: NewsItem, b: NewsItem) {
  return isNearDuplicateTopic(a, b);
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

function normalizeDailyTitle(value: string) {
  return value.toLowerCase().replace(/[^\p{Script=Han}a-z0-9]+/gu, "");
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

export function saveDailyReport(input: { report_date: string; content_markdown: string; content_text?: string; status?: string }) {
  const db = getDb();
  const title = "中国电信系统部新闻情报日报";
  const contentText = input.content_text || markdownToText(input.content_markdown);
  const existing = db.prepare("SELECT id FROM daily_reports WHERE report_date = ?").get(input.report_date) as { id: number } | undefined;
  if (existing) {
    db.prepare(`
      UPDATE daily_reports
      SET title = ?, content_markdown = ?, content_text = ?, status = ?, updated_at = ?
      WHERE id = ?
    `).run(title, input.content_markdown, contentText, input.status || "draft", nowIso(), existing.id);
    return existing.id;
  }
  const result = db.prepare(`
    INSERT INTO daily_reports (report_date, title, content_markdown, content_text, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(input.report_date, title, input.content_markdown, contentText, input.status || "draft", nowIso(), nowIso());
  return Number(result.lastInsertRowid);
}

function briefingSection(items: NewsItem[], articleSummaries: Map<number, string>) {
  return items.length
    ? items.map((item) => formatNewsBrief(item, item.title, "研判", judgement(item), articleSummaries)).join("\n")
    : "- 今日暂无重点信息。";
}

function formatNewsBrief(item: NewsItem, title: string, label: "研判" | "机会", judgementText: string, articleSummaries: Map<number, string>) {
  return [
    `- ${title}`,
    `  概括：${newsSynopsis(item, articleSummaries)}`,
    `  ${label}：${judgementText}`,
    `  原文：[原文链接](${item.url})`
  ].join("\n");
}

function judgement(item: NewsItem) {
  const context = classifyContext(item);
  if (item.category === "舆情和负面信息" || item.risk_level !== "低") return riskJudgement(item);
  if (item.is_china_telecom_related && item.is_huawei_related) {
    return `${context.owner}在${context.track}上的华为协同案例，价值不只是单点项目落地，更在于可沉淀为省公司复制话术、标杆材料和客户沟通样板。`;
  }
  if (item.is_china_telecom_related) {
    return `${context.owner}动态，落点在${context.track}；建议判断其对政企、家庭或云网业务的拉动方式，并补充是否存在华为可切入的方案环节。`;
  }
  if (item.is_huawei_related) {
    return `华为在${context.track}方向释放新的方案或生态信号，可用于对照中国电信相关业务场景，筛选可包装成联合方案或客户案例的切入点。`;
  }
  if (context.track === "AI终端与用户入口") return `AI硬件正在从单一终端走向个人智能入口，需关注其是否改变用户触点、数据入口和家庭/个人AI服务形态。`;
  if (context.track === "模型工具链与开发者生态") return `模型工具链变化会影响AI应用开发效率和生态绑定能力，运营商自有AI平台需关注开发者体验、API兼容和企业交付门槛。`;
  if (item.category === "运营商动态") return `运营商在${context.track}方向继续加速，说明行业竞争正在从单纯连接转向体验经营、算网能力和场景服务，需关注是否会影响中国电信同类业务节奏。`;
  if (item.category === "AI 服务商动态") return `${context.track}方向的AI服务变化，可能影响运营商自有模型、智能体和政企AI服务选型，重点看能力、价格、生态合作和私有化交付门槛。`;
  if (item.category === "AI 产品商品") return `${context.track}正在成为新的用户入口，需关注其是否改变家庭、个人或行业终端触点，并评估与天翼终端、家庭AI服务的结合可能。`;
  if (item.category === "IT 设备商动态") return `${context.track}供给变化会影响智算项目成本、国产替代路径和集采节奏，建议关注对电信云、智算中心和行业客户方案的传导。`;
  if (item.category === "CT 设备商动态") return `${context.track}相关动态会影响运营商网络建设、设备生态或行业数字化方案选择，建议关注是否形成5G-A、光网、核心网或自动化能力的新项目窗口。`;
  if (item.category === "全球宏观热点") return `外部政策、供应链或营商环境变化可能影响ICT投资节奏和客户预算，建议关注对算力、芯片、网络设备和云服务采购的间接影响。`;
  return `${context.track}方向出现新的行业信号，建议先纳入观察池，后续结合客户需求和项目机会补充判断。`;
}

function riskJudgement(item: NewsItem) {
  const context = classifyContext(item);
  if (item.risk_level === "高") return `${context.owner}相关高风险信号，需优先判断是否涉及服务连续性、数据安全、监管处罚或客户信任，并同步观察是否向运营商行业扩散。`;
  if (item.risk_level === "中") return `${context.track}方向存在潜在舆情或合规压力，建议持续跟踪后续进展，必要时补充影响范围、责任主体和客户侧感知。`;
  return `当前风险等级较低，但涉及${context.track}，可纳入舆情观察池，重点看是否出现投诉扩散、监管介入或竞品借势传播。`;
}

function classifyContext(item: NewsItem) {
  const text = `${item.title} ${item.summary} ${item.event} ${item.vendors} ${item.keywords}`;
  return {
    owner: ownerLabel(text),
    track: trackLabel(text)
  };
}

function ownerLabel(text: string) {
  const provincialTelecom = text.match(/([\u4e00-\u9fa5]{2,4})(?:省|市)?电信/);
  if (provincialTelecom && !provincialTelecom[0].includes("中国电信")) return `${provincialTelecom[0]}相关单位`;
  if (/中国电信研究院|电信研究院/.test(text)) return "中国电信研究院";
  if (/中国电信|天翼云|天翼|翼支付|号百/.test(text)) return "中国电信集团或专业公司";
  if (/中国移动|移动/.test(text)) return "中国移动";
  if (/中国联通|联通/.test(text)) return "中国联通";
  if (/中国广电|广电/.test(text)) return "中国广电";
  if (/华为/.test(text)) return "华为";
  return "相关主体";
}

function trackLabel(text: string) {
  if (/Anthropic|OpenAI|Gemini|DeepSeek|通义|混元|文心|Kimi|豆包|智谱|SDK|API|开发者|工具链/.test(text)) return "模型工具链与开发者生态";
  if (/Agent.*硬件|硬件.*Agent|YoooClaw|终端|手机|眼镜|机器人|耳机|AI PC|穿戴|具身/.test(text)) return "AI终端与用户入口";
  if (/5G-A|5GA|5G\s?A|RedCap|上行|超级上行|网络体验|体验分级|速率分级/.test(text)) return "5G-A体验经营和网络能力开放";
  if (/空芯光纤|OTN|PON|光网|光网络|光通信|光纤|光缆|传输|全光|千兆|万兆/.test(text)) return "光网传输和全光底座";
  if (/FTTR|宽带|全光|千兆|万兆|家庭|智屏|路由|Wi-Fi|智慧家庭/.test(text)) return "家庭宽带与智慧家庭";
  if (/AMD|苏姿丰|英伟达|NVIDIA|寒武纪|海光|摩尔线程|沐曦|燧原|AI WAN|算网|智算|算力|云网|数据中心|服务器|GPU|芯片|液冷|大模型|智能体|Agent/.test(text)) return "云网算力与AI基础设施";
  if (/AI网络|星河AI网络|智联|网络智能/.test(text)) return "AI网络与安全能力";
  if (/安全|防护|泄露|故障|投诉|处罚|中断|攻击|舆情|合规|监管/.test(text)) return "安全合规与服务风险";
  if (/核心网|专网|网络自动化|自智/.test(text)) return "核心网、专网与网络自动化";
  if (/制造|精密|产业链|供应链|工控|嵌入式|主板|物联网|IOTE|模组/.test(text)) return "产业链、工业硬件与物联网";
  if (/政企|行业|园区|制造|医疗|教育|金融|交通|低空/.test(text)) return "政企行业数字化";
  if (/关税|制裁|供应链|利率|通胀|政策|监管|营商/.test(text)) return "政策环境与产业链";
  return "相关业务";
}

function hasCompetitorSignal(item: NewsItem) {
  const text = `${item.title} ${item.vendors} ${item.keywords}`;
  return /中兴|新华三|H3C|爱立信|诺基亚|Nokia|思科|Ciena|烽火/.test(text) && !/华为/.test(text);
}

async function loadArticleSummaries(items: NewsItem[]) {
  const pairs = await Promise.all(items.map(async (item) => {
    const summary = await summarizeOriginalArticle(item);
    return [item.id, summary] as const;
  }));
  return new Map(pairs.filter(([, summary]) => Boolean(summary)) as Array<readonly [number, string]>);
}

async function summarizeOriginalArticle(item: NewsItem) {
  try {
    const articleText = await fetchArticleText(item.url);
    if (!articleText) return "";
    return summarizeArticleText(articleText, item);
  } catch {
    return "";
  }
}

async function fetchArticleText(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 ChinaTelecomIntelPlatform/0.1",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });
    if (!response.ok) return "";
    const buffer = Buffer.from(await response.arrayBuffer());
    const head = buffer.subarray(0, 500).toString("latin1");
    const contentType = response.headers.get("content-type") || "";
    const declaredEncoding =
      contentType.match(/charset=([^;]+)/i)?.[1] ||
      head.match(/charset=["']?([^"'\s>]+)/i)?.[1] ||
      "utf-8";
    const encoding = /gb|big5/i.test(declaredEncoding) ? "gbk" : "utf-8";
    const html = new TextDecoder(encoding).decode(buffer);
    return extractArticleText(html);
  } finally {
    clearTimeout(timeout);
  }
}

function extractArticleText(html: string) {
  const scoped =
    pickFirstMatch(html, [
      /<div[^>]*id=["']artibody["'][^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]+id=["'][^"']*(?:artibody|article|content|mainContent)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
      /<article[^>]*>([\s\S]*?)<\/article>/i,
      /<div[^>]+class=["'][^"']*(?:article-content|article_content|article-body|article_body|news_content|main_content|TRS_Editor|text)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i
    ]) || html;
  const paragraphs = Array.from(scoped.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi))
    .map((match) => stripHtmlForArticle(match[1]))
    .filter(isUsefulArticleParagraph);
  const lines = paragraphs.length ? paragraphs : stripHtmlForArticle(scoped).split(/[。！？!?]\s*/).map((line) => line.trim()).filter(isUsefulArticleParagraph);
  return lines.slice(0, 12).join("。");
}

function pickFirstMatch(value: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[1]) return match[1];
  }
  return "";
}

function stripHtmlForArticle(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&ldquo;|&#8220;/g, "“")
    .replace(/&rdquo;|&#8221;/g, "”")
    .replace(/&lsquo;|&#8216;/g, "‘")
    .replace(/&rsquo;|&#8217;/g, "’")
    .replace(/&mdash;|&#8212;/g, "—")
    .replace(/&hellip;|&#8230;/g, "…")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/\s+/g, " ")
    .trim();
}

function isUsefulArticleParagraph(value: string) {
  if (value.length < 18) return false;
  if (/责任编辑|版权所有|公众号|扫码|微信|广告|上一篇|下一篇|相关阅读|C114讯|飞象网讯|本文结束|正文\s*$/.test(value)) return false;
  if (/>/.test(value) && /正文|首页|新闻|科技|财经|科学探索/.test(value)) return false;
  return /[\u4e00-\u9fa5]/.test(value);
}

function summarizeArticleText(text: string, item: NewsItem) {
  const sentences = splitChineseSentences(text)
    .filter((sentence) => !sentence.includes(item.title))
    .filter((sentence) => !isTitleLikeSentence(sentence, item.title))
    .map(compactArticleSentence)
    .filter((sentence) => sentence.length >= 16 && sentence.length <= 140);
  const picked = pickSummarySentences(sentences, item).slice(0, 2);
  if (!picked.length) return "";
  return picked.map(ensureSentenceEnd).join("");
}

function splitChineseSentences(text: string) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[。！？!?])\s*/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function pickSummarySentences(sentences: string[], item: NewsItem) {
  const context = classifyContext(item);
  const terms = [
    ...item.title.split(/[，,：:；;、“”《》\s]+/).filter((term) => term.length >= 2).slice(0, 5),
    ...context.track.split(/[、与和]/).filter((term) => term.length >= 2),
    ...String(item.vendors || "").split("、").filter(Boolean)
  ];
  return [...sentences]
    .map((sentence, index) => ({
      sentence,
      score: terms.reduce((sum, term) => sum + (sentence.includes(term) ? 2 : 0), 0) + (index < 4 ? 2 : 0) + (/表示|宣布|发布|完成|中标|启动|建设|合作|规模|首次|将/.test(sentence) ? 2 : 0)
    }))
    .sort((a, b) => b.score - a.score)
    .map((item) => item.sentence);
}

function compactArticleSentence(sentence: string) {
  const clean = sentence.replace(/\s+/g, " ").trim();
  if (clean.length <= 120) return clean;
  const clauses = clean.split(/(?<=[，；、,;])\s*/);
  let output = "";
  for (const clause of clauses) {
    if (!clause) continue;
    if ((output + clause).length > 118) break;
    output += clause;
  }
  return output || `${clean.slice(0, 118)}…`;
}

function isTitleLikeSentence(sentence: string, title: string) {
  const normalizedSentence = normalizeDailyTitle(sentence);
  const normalizedTitle = normalizeDailyTitle(title);
  if (!normalizedSentence || !normalizedTitle) return false;
  return normalizedSentence.includes(normalizedTitle) || normalizedTitle.includes(normalizedSentence) || titleSimilarity(normalizedSentence, normalizedTitle) >= 0.7;
}

function newsSynopsis(item: NewsItem, articleSummaries: Map<number, string>) {
  const articleSummary = articleSummaries.get(item.id);
  if (articleSummary) return articleSummary;
  const context = classifyContext(item);
  const candidates = [item.summary, item.event]
    .map(cleanSentence)
    .filter((value) => value && !isLowValueSynopsis(value, item.title))
    .filter(Boolean);
  const unique: string[] = [];
  for (const candidate of candidates) {
    if (unique.some((value) => value.includes(candidate) || candidate.includes(value))) continue;
    unique.push(candidate);
    if (unique.length >= 2) break;
  }
  if (!unique.length) unique.push(`当前可确认：${item.title}`);
  if (unique.length < 2) unique.push(`主体为${context.owner}，场景为${context.track}`);
  return unique.map(ensureSentenceEnd).join("");
}

function cleanSentence(value?: string) {
  return (value || "")
    .replace(/^公开新闻显示[：:]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isLowValueSynopsis(value: string, title: string) {
  const normalizedValue = value.replace(/\s+/g, "");
  const normalizedTitle = title.replace(/\s+/g, "");
  return normalizedValue === normalizedTitle || normalizedValue === `公开新闻显示：${normalizedTitle}`;
}

function ensureSentenceEnd(value: string) {
  const clean = value.replace(/[，,；;、：:]+$/g, "").trim();
  return /[。！？!?]$/.test(clean) ? clean : `${clean}。`;
}

function compactSentence(value?: string) {
  if (!value) return "建议持续观察后续进展，并结合客户、区域和项目场景补充判断。";
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return "建议持续观察后续进展，并结合客户、区域和项目场景补充判断。";
  return text.length > 72 ? `${text.slice(0, 72)}...` : text;
}

export function markdownToText(markdown: string) {
  return markdown
    .replace(/^#\s+/gm, "")
    .replace(/^##\s+/gm, "")
    .replace(/\*\*/g, "")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1：$2")
    .replace(/^- /gm, "• ")
    .trim();
}

export function categoryCountsForToday() {
  const db = getDb();
  const { start, end } = getShanghaiDayRange(getShanghaiToday());
  return CATEGORIES.map((category) => {
    const row = db.prepare(`
      SELECT COUNT(*) as count
      FROM news
      WHERE category = ?
        AND published_at BETWEEN ? AND ?
        AND is_publish_time_verified = 1
        AND source IN (SELECT source_name FROM sources WHERE enabled = 1)
    `).get(category, start, end) as { count: number };
    return { category, count: row.count };
  });
}
