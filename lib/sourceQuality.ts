const sourceQuality: Array<{ pattern: RegExp; score: number }> = [
  { pattern: /C114|通信世界|人民邮电|工信|工业和信息化|中国电信|中国移动|中国联通|中国广电/i, score: 5 },
  { pattern: /新华|人民网|央视|中国新闻网|证券时报|上海证券报|第一财经/i, score: 4 },
  { pattern: /机器之心|量子位|少数派|财新|澎湃/i, score: 3 },
  { pattern: /新浪|36氪|钛媒体|集微|芯东西/i, score: 2 }
];

export function sourceQualityScore(source: string) {
  return sourceQuality.find((item) => item.pattern.test(source))?.score || 1;
}

export function combinedSourceQualityScore(source: string, configuredScore?: number) {
  return Math.max(sourceQualityScore(source), configuredScore || 0);
}
