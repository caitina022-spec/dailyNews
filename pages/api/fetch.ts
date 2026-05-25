import type { NextApiRequest, NextApiResponse } from "next";
import { fetchNews } from "@/lib/fetcher";
import { fail, ok } from "@/lib/api";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return fail(res, "Method not allowed", 405);
  try {
    ok(res, await fetchNews());
  } catch (error) {
    fail(res, error);
  }
}
