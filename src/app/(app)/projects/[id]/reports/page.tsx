"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PageShell } from "@/components/layout/PageShell";
import { ICONS } from "@/components/pixel";
import { apiFetch } from "@/lib/api";
import type { ProjectReport } from "@/lib/types";

const TYPE_LABEL = { daily: "日报", weekly: "周报" };
const TYPE_COLOR = { daily: "#3182CE", weekly: "#805AD5" };

export default function ProjectReportsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [reports, setReports] = useState<ProjectReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<"daily" | "weekly" | null>(null);
  const [selected, setSelected] = useState<ProjectReport | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<ProjectReport[]>(`/projects/${id}/reports`)
      .then((data) => {
        setReports(data);
        if (data.length > 0) setSelected(data[0]);
      })
      .catch(() => router.push(`/projects/${id}`))
      .finally(() => setLoading(false));
  }, [id, router]);

  async function handleGenerate(type: "daily" | "weekly") {
    setError("");
    setGenerating(type);
    try {
      await apiFetch(`/projects/${id}/reports/generate?report_type=${type}`, { method: "POST" });
      const updated = await apiFetch<ProjectReport[]>(`/projects/${id}/reports`);
      setReports(updated);
      if (updated.length > 0) setSelected(updated[0]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "生成失败");
    } finally {
      setGenerating(null);
    }
  }

  return (
    <PageShell
      title="日/周报"
      icon={ICONS.project}
      actions={
        <div className="flex gap-2">
          <Link
            href={`/projects/${id}`}
            className="px-3 py-1.5 text-[10px] font-bold uppercase border-2 border-[#1A202C] bg-white text-[#1A202C] hover:bg-[#CCF2FF] transition-colors"
          >
            ← 返回项目
          </Link>
          <button
            onClick={() => handleGenerate("daily")}
            disabled={!!generating}
            className="px-3 py-1.5 text-[10px] font-bold uppercase border-2 border-[#3182CE] text-[#3182CE] hover:bg-[#EBF8FF] disabled:opacity-50 transition-colors"
          >
            {generating === "daily" ? "生成中..." : "+ 生成日报"}
          </button>
          <button
            onClick={() => handleGenerate("weekly")}
            disabled={!!generating}
            className="px-3 py-1.5 text-[10px] font-bold uppercase border-2 border-[#805AD5] text-[#805AD5] hover:bg-[#E9D8FD] disabled:opacity-50 transition-colors"
          >
            {generating === "weekly" ? "生成中..." : "+ 生成周报"}
          </button>
        </div>
      }
    >
      {error && (
        <div className="text-[10px] font-bold text-red-500 border border-red-300 px-3 py-2 bg-red-50 mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-[10px] text-gray-400 font-bold uppercase text-center py-16">加载中...</div>
      ) : (
        <div className="flex gap-5 h-full">
          {/* 左侧报告列表 */}
          <div className="w-56 flex-shrink-0 flex flex-col gap-1">
            <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] mb-2">
              — 报告列表
            </div>
            {reports.length === 0 ? (
              <div className="text-[10px] text-gray-400 text-center py-8">
                暂无报告，点击右上角生成
              </div>
            ) : (
              reports.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className={`w-full text-left px-3 py-2.5 border-2 transition-colors ${
                    selected?.id === r.id
                      ? "border-[#1A202C] bg-[#CCF2FF]"
                      : "border-transparent bg-white hover:border-[#1A202C]"
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span
                      className="text-[8px] font-bold px-1 py-0.5"
                      style={{
                        background: TYPE_COLOR[r.report_type],
                        color: "white",
                      }}
                    >
                      {TYPE_LABEL[r.report_type]}
                    </span>
                  </div>
                  <div className="text-[10px] font-bold text-[#1A202C]">
                    {r.period_start} ~ {r.period_end}
                  </div>
                  <div className="text-[9px] text-gray-400 mt-0.5">
                    {r.created_at?.slice(0, 16).replace("T", " ")}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* 右侧内容 */}
          <div className="flex-1 border-2 border-[#1A202C] bg-white p-5 overflow-auto">
            {!selected ? (
              <div className="text-[10px] text-gray-400 text-center py-16">
                选择左侧报告查看内容
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-4 border-b-2 border-[#1A202C] pb-3">
                  <span
                    className="text-[9px] font-bold px-2 py-1"
                    style={{ background: TYPE_COLOR[selected.report_type], color: "white" }}
                  >
                    {TYPE_LABEL[selected.report_type]}
                  </span>
                  <span className="text-[11px] font-bold text-[#1A202C]">
                    {selected.period_start} 至 {selected.period_end}
                  </span>
                  <span className="text-[9px] text-gray-400 ml-auto">
                    生成于 {selected.created_at?.slice(0, 16).replace("T", " ")}
                  </span>
                </div>
                <div className="text-[11px] text-[#1A202C] leading-relaxed whitespace-pre-wrap">
                  {selected.content || "暂无内容"}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </PageShell>
  );
}
