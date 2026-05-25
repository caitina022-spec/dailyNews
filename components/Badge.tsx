import { ReactNode } from "react";

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "blue" | "red" | "amber" | "green" }) {
  const tones = {
    slate: "border-slate-400/30 bg-slate-400/10 text-slate-200",
    blue: "border-telecom/40 bg-telecom/15 text-cyan",
    red: "border-huawei/45 bg-huawei/15 text-red-100",
    amber: "border-amber-300/40 bg-amber-300/12 text-amber-100",
    green: "border-emerald-300/35 bg-emerald-300/12 text-emerald-100"
  };
  return <span className={`inline-flex rounded border px-2 py-1 text-xs font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ${tones[tone]}`}>{children}</span>;
}
