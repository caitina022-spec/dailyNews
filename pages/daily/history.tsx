import { useEffect, useState } from "react";
import Link from "next/link";
import Layout from "@/components/Layout";
import { api } from "@/lib/client";

type Row = { id: number; report_date: string; title: string; status: string; updated_at: string };

export default function DailyHistoryPage() {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    api<Row[]>("/api/daily/history").then(setRows);
  }, []);
  return (
    <Layout>
      <div className="mb-5">
        <div className="mb-2 h-1 w-20 rounded-full tech-divider" />
        <h1 className="tech-title text-2xl font-semibold">历史日报</h1>
      </div>
      <div className="tech-panel overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-telecom/10 text-cyan">
            <tr>
              <th className="px-4 py-3">日期</th>
              <th className="px-4 py-3">标题</th>
              <th className="px-4 py-3">状态</th>
              <th className="px-4 py-3">更新时间</th>
              <th className="px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-line text-slate-300 transition hover:bg-telecom/10">
                <td className="px-4 py-3 font-medium text-ink">{row.report_date}</td>
                <td className="px-4 py-3">{row.title}</td>
                <td className="px-4 py-3 text-cyan">{row.status}</td>
                <td className="px-4 py-3">{new Date(row.updated_at).toLocaleString("zh-CN")}</td>
                <td className="px-4 py-3">
                  <Link href={`/daily?date=${row.report_date}`} className="tech-link">打开编辑</Link>
                </td>
              </tr>
            ))}
            {!rows.length ? <tr><td className="px-4 py-8 text-center text-muted" colSpan={5}>暂无历史日报。</td></tr> : null}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}
