"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import type { OkrPeriod, KpiAssignment } from "@/lib/types";
import ImportWizard from "./ImportWizard";

/* ── 类型 ─────────────────────────────────────────────────────────── */
interface KpiSummary {
  total: number;
  level_distribution: Record<string, number>;
  department_avg_scores: Record<string, number>;
}

/* ── 等级 badge 配色 ──────────────────────────────────────────────── */
const LEVEL_COLORS: Record<string, string> = {
  S: "bg-purple-100 text-purple-700",
  A: "bg-green-100 text-green-700",
  B: "bg-blue-100 text-blue-700",
  C: "bg-yellow-100 text-yellow-700",
  D: "bg-red-100 text-red-700",
};

function LevelBadge({ level }: { level: string | null }) {
  if (!level) return <span className="text-xs text-gray-400">-</span>;
  const cls = LEVEL_COLORS[level] ?? "bg-gray-200 text-gray-700";
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {level}
    </span>
  );
}

/* ── 状态映射 ─────────────────────────────────────────────────────── */
const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  draft: { label: "草稿", cls: "bg-gray-200 text-gray-700" },
  submitted: { label: "已提交", cls: "bg-blue-100 text-blue-700" },
  evaluated: { label: "已评估", cls: "bg-orange-100 text-orange-700" },
  confirmed: { label: "已确认", cls: "bg-green-100 text-green-700" },
};

function StatusBadge({ status }: { status: string }) {
  const info = STATUS_MAP[status] ?? { label: status, cls: "bg-gray-200 text-gray-700" };
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${info.cls}`}>
      {info.label}
    </span>
  );
}

/* ── 主组件 ──────────────────────────────────────────────────────── */
export default function KpiTab() {
  const [periods, setPeriods] = useState<OkrPeriod[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null);
  const [assignments, setAssignments] = useState<KpiAssignment[]>([]);
  const [summary, setSummary] = useState<KpiSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [showImport, setShowImport] = useState(false);

  /* 加载周期列表 */
  useEffect(() => {
    apiFetch<OkrPeriod[]>("/api/org-management/okr/periods").then((data) => {
      setPeriods(data);
      if (data.length > 0 && selectedPeriod === null) {
        setSelectedPeriod(data[0].id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 加载 KPI 数据 */
  const fetchData = useCallback(async () => {
    if (selectedPeriod === null) return;
    setLoading(true);
    try {
      const [aData, sData] = await Promise.all([
        apiFetch<KpiAssignment[]>(
          `/api/org-management/kpi/assignments?period_id=${selectedPeriod}`,
        ),
        apiFetch<KpiSummary>(
          `/api/org-management/kpi/summary?period_id=${selectedPeriod}`,
        ),
      ]);
      setAssignments(aData);
      setSummary(sData);
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* 等级分布排序 */
  const levelOrder = ["S", "A", "B", "C", "D"];

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex items-center gap-3">
        <select
          className="rounded border border-gray-300 px-3 py-1.5 text-sm"
          value={selectedPeriod ?? ""}
          onChange={(e) => setSelectedPeriod(Number(e.target.value))}
        >
          {periods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <button
          className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
          onClick={() => setShowImport(true)}
        >
          导入
        </button>
      </div>

      {/* 汇总卡片 */}
      {summary && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* 总数 */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-xs text-gray-500">考核总数</div>
            <div className="mt-1 text-2xl font-bold text-gray-900">{summary.total}</div>
          </div>

          {/* 等级分布 */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-2 text-xs text-gray-500">等级分布</div>
            <div className="flex flex-wrap gap-2">
              {levelOrder.map((lv) => {
                const count = summary.level_distribution[lv] ?? 0;
                if (count === 0) return null;
                return (
                  <div key={lv} className="flex items-center gap-1">
                    <LevelBadge level={lv} />
                    <span className="text-sm text-gray-700">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 数据表 */}
      {loading ? (
        <div className="py-12 text-center text-sm text-gray-400">加载中…</div>
      ) : assignments.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-400">暂无 KPI 数据</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-xs text-gray-500">
                <th className="px-4 py-2 font-medium">员工 ID</th>
                <th className="px-4 py-2 font-medium">部门 ID</th>
                <th className="px-4 py-2 font-medium">总分</th>
                <th className="px-4 py-2 font-medium">等级</th>
                <th className="px-4 py-2 font-medium">状态</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-900">{a.user_id}</td>
                  <td className="px-4 py-2 text-gray-600">{a.department_id ?? "-"}</td>
                  <td className="px-4 py-2 font-medium text-gray-900">
                    {a.total_score != null ? a.total_score.toFixed(1) : "-"}
                  </td>
                  <td className="px-4 py-2">
                    <LevelBadge level={a.level} />
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={a.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 导入向导 */}
      {showImport && (
        <ImportWizard
          importType="kpi"
          onClose={() => {
            setShowImport(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
}
