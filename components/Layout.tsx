import Link from "next/link";
import { useRouter } from "next/router";
import { ReactNode } from "react";

const nav = [
  { href: "/", label: "Dashboard" },
  { href: "/news", label: "新闻列表" },
  { href: "/daily", label: "日报生成" },
  { href: "/daily/history", label: "历史日报" },
  { href: "/settings/sources", label: "新闻源" }
];

export default function Layout({ children }: { children: ReactNode }) {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-panel text-ink">
      <header className="sticky top-0 z-30 border-b border-line bg-[#06111f]/88 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link href="/" className="group flex items-center gap-3">
            <span className="relative flex h-10 w-10 items-center justify-center rounded-md border border-telecom/50 bg-telecom/10 shadow-[0_0_28px_rgba(15,124,255,0.28)]">
              <span className="h-4 w-4 rounded-sm border-2 border-cyan" />
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-huawei shadow-[0_0_14px_rgba(226,43,69,0.9)]" />
            </span>
            <span className="flex flex-col">
              <span className="text-lg font-semibold tracking-wide text-ink group-hover:text-white">中国电信系统部新闻情报平台</span>
              <span className="text-xs text-muted">ICT / AI / 运营商 / 舆情日报工作台</span>
            </span>
          </Link>
          <nav className="flex flex-wrap gap-2">
            {nav.map((item) => {
              const active = router.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-md px-3 py-2 text-sm transition ${active ? "bg-telecom text-white shadow-[0_0_22px_rgba(15,124,255,0.35)]" : "text-muted hover:bg-white/5 hover:text-ink"}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-6">{children}</main>
    </div>
  );
}
