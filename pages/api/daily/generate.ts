import type { NextApiRequest, NextApiResponse } from "next";
import { generateDailyReport } from "@/lib/daily";
import { fail, ok } from "@/lib/api";
import { getShanghaiToday } from "@/lib/date";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return fail(res, "Method not allowed", 405);
  try {
    const date = String(req.body?.date || getShanghaiToday());
    ok(res, await generateDailyReport(date));
  } catch (error) {
    fail(res, error);
  }
}
