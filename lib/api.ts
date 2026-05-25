import type { NextApiResponse } from "next";

export function ok<T>(res: NextApiResponse, data: T) {
  res.status(200).json({ ok: true, data });
}

export function fail(res: NextApiResponse, error: unknown, status = 500) {
  res.status(status).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
}
