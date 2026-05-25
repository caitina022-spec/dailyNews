import { Category, CATEGORIES, RiskLevel } from "./types";

type CategoryRule = {
  category: Category;
  strong: string[];
  vendors: string[];
  keywords: string[];
  semantic: string[];
};

const categoryRules: CategoryRule[] = [
  {
    category: "舆情和负面信息",
    strong: ["数据泄露", "服务中断", "网络故障", "监管处罚", "安全事件", "业务中断", "重大舆情", "AI造假", "AI侵权"],
    vendors: ["中国电信", "电信", "运营商", "云服务", "AI行业", "通信设备商"],
    keywords: ["通信", "AI", "安全", "故障", "投诉", "泄露", "处罚", "争议", "中断", "侵权", "造假", "伦理"],
    semantic: ["网络攻击", "用户争议", "资费争议", "服务投诉", "业务中断", "负面报道", "AI安全", "数据安全", "隐私泄露"]
  },
  {
    category: "运营商动态",
    strong: ["中国移动", "中国联通", "中国电信", "中国广电", "Orange", "Vodafone", "Telefonica", "Deutsche Telekom"],
    vendors: ["中国移动", "中国联通", "中国电信", "中国广电", "广电", "Orange", "DT", "Telefonica", "Vodafone", "KT", "SKT", "STC", "Zain"],
    keywords: ["运营商", "大T", "5G-A", "云网融合", "政企", "算力网络", "数据中心", "财报", "网络建设"],
    semantic: ["运营商战略", "AI应用", "国际合作", "组织调整", "重大客户合作", "行业数字化", "家庭业务", "终端合作"]
  },
  {
    category: "CT 设备商动态",
    strong: ["5G-A", "Open RAN", "AI-RAN", "核心网", "光通信", "光模块", "运营商网络升级"],
    vendors: ["爱立信", "Ericsson", "Nokia", "诺基亚", "思科", "Cisco", "Ciena", "Infinera", "华三", "H3C", "华为", "中兴", "烽火通信"],
    keywords: ["通信设备", "无线网络", "核心网", "传输网", "光网络", "光通信", "路由器", "交换机", "专网"],
    semantic: ["网络自动化", "运营商网络", "网络升级", "无线接入网", "RedCap", "卫星通信", "物联网", "网络设备"]
  },
  {
    category: "IT 设备商动态",
    strong: ["GPU", "AI芯片", "国产GPU", "AI服务器", "智算中心", "算力集群", "训练芯片", "推理芯片"],
    vendors: ["NVIDIA", "英伟达", "AMD", "Google TPU", "谷歌TPU", "Amazon Trainium", "亚马逊Trainium", "高通", "Qualcomm", "寒武纪", "海光", "摩尔线程", "沐曦股份", "沐曦", "燧原科技", "燧原", "瀚博半导体", "曙光", "中科曙光", "阿里巴巴", "阿里云", "壁仞科技", "壁仞", "中兴珠峰", "飞腾"],
    keywords: ["通算", "智算", "服务器", "数据中心", "液冷", "存储", "网络设备", "算力基础设施", "AI基础设施"],
    semantic: ["芯片生态", "国产替代", "云基础设施", "算力供应商", "训练集群", "推理集群", "智算供应商"]
  },
  {
    category: "AI 产品商品",
    strong: ["AI眼镜", "智能眼镜", "XR眼镜", "AR眼镜", "AI玩具", "AI手机", "人形机器人", "具身智能", "AI终端", "端侧AI"],
    vendors: ["阿里夸克", "夸克", "Rokid", "VITURE", "Meta", "Google", "字节跳动", "豆包手机", "华为", "百度", "小米", "珞博智能", "京东", "科大讯飞", "三星", "苹果", "vivo", "OPPO", "Figure AI", "智元机器人", "AGIBOT"],
    keywords: ["穿戴类新产品", "AI硬件", "XR智能眼镜", "AR智能眼镜", "XR设备", "AR设备", "AI耳机", "AI PC", "机器人", "智能座舱", "消费级AI产品"],
    semantic: ["终端侧大模型", "端侧AI能力", "智能硬件", "AI穿戴", "AI消费电子", "AI座舱", "空间计算"]
  },
  {
    category: "AI 服务商动态",
    strong: ["大模型", "智能体", "Agent", "OpenAI", "Anthropic", "DeepSeek", "通义千问", "腾讯混元", "百度文心", "Kimi", "豆包"],
    vendors: ["OpenAI", "Google Gemini", "Gemini", "Anthropic", "Grok", "Llama", "DeepSeek", "阿里通义千问", "通义千问", "腾讯混元", "混元", "百度文心", "文心", "月之暗面", "Kimi", "字节豆包", "豆包", "智谱", "电信星辰", "星辰", "移动九天", "九天", "联通元景", "元景"],
    keywords: ["模型发布", "模型升级", "API", "模型价格", "模型评测", "企业级AI服务", "AI助手", "模型生态"],
    semantic: ["云上模型服务", "模型能力评测", "模型生态合作", "Agent 产品", "AI搜索", "AI办公", "AI云服务"]
  },
  {
    category: "全球宏观热点",
    strong: ["关税", "制裁", "贸易摩擦", "地缘冲突", "营商环境", "产业政策", "国际组织报告"],
    vendors: [],
    keywords: ["政策", "国际热点", "趋势", "国际政治", "外交关系", "全球经济", "通胀", "利率", "能源", "供应链"],
    semantic: ["投资环境", "营商环境变化", "国际组织", "全球宏观", "数字经济", "AI监管", "数据安全", "算力政策"]
  },
  {
    category: "其他行业热点",
    strong: ["AI+金融", "AI+制造", "AI+医疗", "AI+教育", "AI+政务", "AI+交通", "AI+能源", "AI+广告", "AI视频", "AI短剧", "商业航天", "卫星互联网"],
    vendors: ["Meta", "Google", "字节", "腾讯", "阿里", "百度"],
    keywords: ["金融", "制造", "广告", "游戏", "影视", "教育", "医疗", "政务", "交通", "能源", "零售", "办公", "航天", "卫星", "火箭", "低空经济"],
    semantic: ["广告投放", "广告创意生成", "营销自动化", "用户画像", "AIGC广告", "AI生成角色", "AI剧本", "AI特效", "游戏开发", "影视工业化", "虚拟人", "数字人", "组网卫星", "卫星发射"]
  }
];

const allVendors = unique(categoryRules.flatMap((rule) => rule.vendors)).sort((a, b) => b.length - a.length);
const negativeWords = ["故障", "中断", "投诉", "泄露", "处罚", "攻击", "漏洞", "宕机", "事故", "争议", "侵权", "造假", "伦理", "约谈", "封禁", "下架", "违规", "赔偿", "刑拘", "被查", "虚构", "回调"];
const highRiskWords = ["严重故障", "严重事故", "重大事故", "重大故障", "重大舆情", "数据泄露", "瘫痪", "监管处罚", "网络攻击", "群体投诉", "业务中断", "服务中断", "安全事件"];
const explicitRiskWords = ["故障", "中断", "投诉", "泄露", "处罚", "攻击", "漏洞", "宕机", "事故", "侵权", "造假", "伦理", "约谈", "封禁", "下架", "违规", "赔偿", "刑拘", "被查", "虚构", "回调", "安全事件", "数据安全", "隐私"];
const localTelecomPattern = /(北京|上海|天津|重庆|河北|山西|辽宁|吉林|黑龙江|江苏|浙江|安徽|福建|江西|山东|河南|湖北|湖南|广东|海南|四川|贵州|云南|陕西|甘肃|青海|台湾|内蒙古|广西|西藏|宁夏|新疆|香港|澳门|广州|深圳|南京|苏州|杭州|宁波|厦门|青岛|济南|郑州|武汉|长沙|成都|西安|合肥|福州|南昌|沈阳|大连|长春|哈尔滨|昆明|贵阳|兰州|银川|乌鲁木齐|拉萨|石家庄|太原|呼和浩特|南宁|海口|漳州|泉州|无锡|常州|南通|徐州|温州|绍兴|嘉兴|金华|佛山|东莞|珠海|中山|惠州|汕头|烟台|潍坊|临沂|洛阳|宜昌|襄阳|株洲|绵阳|德阳)电信/;

export type AnalysisResult = {
  category: Category;
  vendors: string[];
  keywords: string[];
  summary: string;
  event: string;
  related_entities: string;
  potential_impact: string;
  insight_for_china_telecom: string;
  opportunity_for_huawei: string;
  suggested_action: string;
  importance_score: number;
  risk_level: RiskLevel;
  is_china_telecom_related: boolean;
  is_huawei_related: boolean;
  include_in_daily: boolean;
};

export async function analyzeNews(input: { title: string; content?: string; categoryHint?: string }): Promise<AnalysisResult> {
  if (process.env.OPENAI_API_KEY) {
    const ai = await tryOpenAiAnalysis(input).catch(() => null);
    if (ai) return ai;
  }
  return analyzeNewsByRules(input);
}

export function analyzeNewsByRules(input: { title: string; content?: string; categoryHint?: string }): AnalysisResult {
  const text = `${input.title}\n${stripHtml(input.content || "")}`;
  const lower = text.toLowerCase();
  const matchedVendors = allVendors.filter((vendor) => lower.includes(vendor.toLowerCase()));
  const scoreResult = scoreCategories(text, input.categoryHint);
  const category = scoreResult.category;
  const matchedKeywords = unique(scoreResult.matches.slice(0, 14));
  const isChinaTelecom = /中国电信|天翼|电信云|电信星辰|China Telecom/i.test(text) || localTelecomPattern.test(text);
  const isHuawei = /华为|昇腾|鲲鹏|盘古|鸿蒙|Huawei/i.test(text);
  const detectedRiskLevel = detectRiskLevel(text);
  const riskLevel = shouldCategorizeAsRisk(text, detectedRiskLevel) ? detectedRiskLevel : "低";
  const importance = Math.min(5, Math.max(1, 2 + (isChinaTelecom ? 1 : 0) + (isHuawei ? 1 : 0) + (riskLevel === "中" ? 1 : 0) + (riskLevel === "高" ? 2 : 0) + (matchedVendors.length >= 2 ? 1 : 0)));
  const cleanTitle = input.title.trim();
  const summary = cleanTitle.length > 44 ? `${cleanTitle.slice(0, 44)}...` : cleanTitle;

  return {
    category,
    vendors: matchedVendors,
    keywords: matchedKeywords,
    summary,
    event: `公开新闻显示：${summary}`,
    related_entities: matchedVendors.join("、") || "待人工补充",
    potential_impact: impactText(category, riskLevel),
    insight_for_china_telecom: isChinaTelecom ? "需关注该动态对云网融合、政企业务、客户服务和品牌舆情的直接影响。" : "可作为运营商战略、产品能力或行业客户需求变化的参考信号。",
    opportunity_for_huawei: isHuawei ? "涉及华为相关能力或生态，建议评估与中国电信系统部既有项目的联动机会。" : "建议关注是否可转化为云、网、算、AI 或行业解决方案的协同机会。",
    suggested_action: riskLevel === "高" ? "建议纳入日报并由相关责任人跟进风险研判。" : importance >= 4 ? "建议纳入日报，跟踪后续进展并补充业务判断。" : "建议持续观察，必要时补充到专题材料。",
    importance_score: importance,
    risk_level: riskLevel,
    is_china_telecom_related: isChinaTelecom,
    is_huawei_related: isHuawei,
    include_in_daily: importance >= 4 || riskLevel === "高" || isChinaTelecom
  };
}

function scoreCategories(text: string, hint?: string) {
  const lower = text.toLowerCase();
  const riskLevel = detectRiskLevel(text);
  const shouldUseRiskCategory = shouldCategorizeAsRisk(text, riskLevel);
  if (shouldUseRiskCategory) {
    return { category: "舆情和负面信息" as Category, matches: matchedWords(categoryRules[0], lower) };
  }

  const scored = categoryRules.map((rule) => {
    if (rule.category === "舆情和负面信息" && !shouldUseRiskCategory) {
      return { category: rule.category, score: 0, matches: [] };
    }
    const strong = hits(rule.strong, lower);
    const vendorHits = hits(rule.vendors, lower);
    const keywordHits = hits(rule.keywords, lower);
    const semanticHits = hits(rule.semantic, lower);
    return {
      category: rule.category,
      score: strong.length * 5 + vendorHits.length * 4 + keywordHits.length * 2 + semanticHits.length * 3,
      matches: unique([...strong, ...vendorHits, ...keywordHits, ...semanticHits])
    };
  });

  const best = scored.sort((a, b) => b.score - a.score)[0];
  if (best?.score > 0) return best;
  if (hint && hint !== "舆情和负面信息" && CATEGORIES.includes(hint as Category)) return { category: hint as Category, matches: [] };
  return { category: "其他行业热点" as Category, matches: [] };
}

function shouldCategorizeAsRisk(text: string, riskLevel: RiskLevel) {
  if (riskLevel === "低") return false;
  const telecomRiskContext = /中国电信|电信|通信|运营商|云服务|网络|宽带|资费|用户|客户|服务/i.test(text);
  if (telecomRiskContext) return true;

  const aiRiskContext = /AI|人工智能|大模型|模型|智能体|Agent|Copilot|算法|数据|隐私|安全/i.test(text);
  const explicitRisk = explicitRiskWords.some((word) => text.includes(word));
  return aiRiskContext && explicitRisk;
}

function detectRiskLevel(text: string): RiskLevel {
  if (highRiskWords.some((word) => text.includes(word))) return "高";
  return negativeWords.some((word) => text.includes(word)) ? "中" : "低";
}

function hits(words: string[], lowerText: string) {
  return words.filter((word) => lowerText.includes(word.toLowerCase()));
}

function matchedWords(rule: CategoryRule, lowerText: string) {
  return unique([...hits(rule.strong, lowerText), ...hits(rule.vendors, lowerText), ...hits(rule.keywords, lowerText), ...hits(rule.semantic, lowerText)]);
}

function impactText(category: Category, risk: RiskLevel) {
  if (risk !== "低") return "可能影响行业信任、客户服务稳定性或监管关注度，需要结合后续信息判断风险外溢范围。";
  if (category === "AI 服务商动态") return "可能改变模型能力供给、企业级 AI 服务采购和云上模型生态竞争。";
  if (category === "AI 产品商品") return "可能改变 AI 终端形态、端侧能力和消费级产品入口。";
  if (category === "IT 设备商动态") return "可能影响智算基础设施、芯片生态、设备选型和国产替代节奏。";
  if (category === "CT 设备商动态") return "可能影响运营商网络升级、通信设备选型、5G-A 和网络自动化竞争格局。";
  if (category === "运营商动态") return "可能影响运营商业务布局、云网融合、5G-A、政企市场和算力网络节奏。";
  if (category === "全球宏观热点") return "可能反映政策、地缘、贸易、供应链或营商环境变化。";
  return "可能反映 AI 对传统行业、内容生产、广告营销或产业数字化需求的影响。";
}

function unique(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

async function tryOpenAiAnalysis(input: { title: string; content?: string; categoryHint?: string }): Promise<AnalysisResult | null> {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `你是华为中国电信系统部的中文新闻情报分析助手。只输出 JSON，category 必须是：${CATEGORIES.join("、")}；risk_level 必须是低/中/高。优先识别舆情风险语义，不要只依赖字面关键词。`
      },
      {
        role: "user",
        content: JSON.stringify({
          title: input.title,
          content: input.content?.slice(0, 4000),
          category_hint: input.categoryHint,
          required_fields: [
            "category", "vendors", "keywords", "summary", "event", "related_entities", "potential_impact",
            "insight_for_china_telecom", "opportunity_for_huawei", "suggested_action", "importance_score",
            "risk_level", "is_china_telecom_related", "is_huawei_related", "include_in_daily"
          ]
        })
      }
    ]
  });
  const raw = completion.choices[0]?.message?.content;
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  return {
    ...parsed,
    category: CATEGORIES.includes(parsed.category) ? parsed.category : "其他行业热点",
    importance_score: Math.max(1, Math.min(5, Number(parsed.importance_score) || 3)),
    risk_level: ["低", "中", "高"].includes(parsed.risk_level) ? parsed.risk_level : "低",
    vendors: Array.isArray(parsed.vendors) ? parsed.vendors : [],
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords : []
  };
}
