const TIME_ZONE = "Asia/Shanghai";

export function getShanghaiToday() {
  return formatShanghaiDate(new Date());
}

export function getShanghaiDayRange(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const startMs = Date.UTC(year, month - 1, day, 0, 0, 0) - 8 * 60 * 60 * 1000;
  const endMs = startMs + 24 * 60 * 60 * 1000 - 1;
  return {
    start: new Date(startMs).toISOString(),
    end: new Date(endMs).toISOString()
  };
}

export function addShanghaiDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  const shanghaiNoonUtc = Date.UTC(year, month - 1, day, 4, 0, 0);
  return formatShanghaiDate(new Date(shanghaiNoonUtc + days * 24 * 60 * 60 * 1000));
}

export function getShanghaiDateRange(startDate: string, endDate: string) {
  return {
    start: getShanghaiDayRange(startDate).start,
    end: getShanghaiDayRange(endDate).end
  };
}

export function formatShanghaiDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function getClientToday() {
  return formatShanghaiDate(new Date());
}
