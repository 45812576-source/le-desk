"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import type { OkrPeriod, OkrObjective, OkrKeyResult } from "@/lib/types";
import ImportWizard from "./ImportWizard";

/* ── 进度条颜色 ─────────────────────────────────────────────────── */
function progressColor(v: number) {
  if (v > 70) return "bg-green-500";
  if (v >= 30) return "bg-yellow-500";
  return "bg-red-500";
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 rounded-full bg-gray-200">
        <div
          className={`h-full rounded-full transition-all ${progressColor(pct)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-10 text-right text-xs text-gray-600">{pct}%</span>
    </div>
  );
}

/* ── 状态 badge ──────────────────────────────────────────────────── */
const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  draft: { label: "草稿", cls: "bg-gray-200 text-gray-700" },
  active: { label: "进行中", cls: "bg-blue-100 text-blue-700" },
  completed: { label: "已完成", cls: "bg-green-100 text-green-700" },
  cancelled: { label: "已取消", cls: "bg-red-100 text-red-700" },
  on_track: { label: "正常", cls: "bg-green-100 text-green-700" },
  at_risk: { label: "有风险", cls: "bg-yellow-100 text-yellow-700" },
  behind: { label: "落后", cls: "bg-red-100 text-red-700" },
};

function StatusBadge({ status }: { status: string }) {
  const info = STATUS_MAP[status] ?? { label: status, cls: "bg-gray-200 text-gray-700" };
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${info.cls}`}>
      {info.label}
    </span>
  );
}

const OWNER_TYPE_MAP: Record<string, { label: string; cls: string }> = {
  company: { label: "公司", cls: "bg-purple-100 text-purple-700" },
  department: { label: "部门", cls: "bg-cyan-100 text-cyan-700" },
  user: { label: "个人", cls: "bg-orange-100 text-orange-700" },
};

function OwnerTypeBadge({ type }: { type: string }) {
  const info = OWNER_TYPE_MAP[type] ?? { label: type, cls: "bg-gray-200 text-gray-700" };
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${info.cls}`}>
      {info.label}
    </span>
  );
}

/* ── KR 子表 ─────────────────────────────────────────────────────── */
function KrTable({ krs }: { krs: OkrKeyResult[] }) {
  if (!krs.length) return null;
  return (
    <table className="mt-2 w-full text-sm">
      <thead>
        <tr className="border-b text-left text-xs text-gray-500">
          <th className="pb-1 pr-2 font-medium">关键结果</th>
          <th className="pb-1 pr-2 font-medium w-24">目标值</th>
          <th className="pb-1 pr-2 font-medium w-24">当前值</th>
          <th className="pb-1 pr-2 font-medium w-40">进度</th>
          <th className="pb-1 font-medium w-20">状态</th>
        </tr>
      </thead>
      <tbody>
        {krs.map((kr) => (
          <tr key={kr.id} className="border-b border-gray-100 last:border-0">
            <td className="py-1.5 pr-2">{kr.title}</td>
            <td className="py-1.5 pr-2 text-gray-600">
              {kr.target_value ?? "-"}{kr.unit ? ` ${kr.unit}` : ""}
            </td>
            <td className="py-1.5 pr-2 text-gray-600">
              {kr.current_value ?? "-"}{kr.unit ? ` ${kr.unit}` : ""}
            </td>
            <td className="py-1.5 pr-2">
              <ProgressBar value={kr.progress} />
            </td>
            <td className="py-1.5">
              <StatusBadge status={kr.status} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ── Objective 卡片（递归渲染层级） ──────────────────────────────── */
function ObjectiveCard({ obj, depth }: { obj: OkrObjective; depth: number }) {
  return (
    <div style={{ marginLeft: depth * 24 }}>
      <div className="mb-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        {/* 标题行 */}
        <div className="mb-2 flex items-center gap-2">
          <OwnerTypeBadge type={obj.owner_type} />
          <span className="flex-1 font-medium text-gray-900">{obj.title}</span>
          <StatusBadge status={obj.status} />
        </div>

        {/* 进度 */}
        <div className="mb-2">
          <ProgressBar value={obj.progress} />
        </div>

        {/* KR 列表 */}
        {obj.key_results && obj.key_results.length > 0 && (
          <div className="mt-3 rounded bg-gray-50 p-3">
            <KrTable krs={obj.key_results} />
          </div>
        )}
      </div>

      {/* 递归子目标 */}
      {obj.children?.map((child) => (
        <ObjectiveCard key={child.id} obj={child} depth={depth + 1} />
      ))}
    </div>
  );
}

/* ── 主组件 ──────────────────────────────────────────────────────── */
export default function OkrTab() {
  const [periods, setPeriods] = useState<OkrPeriod[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null);
  const [objectives, setObjectives] = useState<OkrObjective[]>([]);
  const [loading, setLoading] = useState(false);
  const [recalcing, setRecalcing] = useState(false);
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

  /* 加载 OKR 树 */
  const fetchTree = useCallback(async () => {
    if (selectedPeriod === null) return;
    setLoading(true);
    try {
      const data = await apiFetch<OkrObjective[]>(
        `/api/org-management/okr/tree?period_id=${selectedPeriod}`,
      );
      setObjectives(data);
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod]);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  /* 重算进度 */
  const handleRecalc = async () => {
    if (selectedPeriod === null) return;
    setRecalcing(true);
    try {
      await apiFetch(`/api/org-management/okr/recalc-progress?period_id=${selectedPeriod}`, {
        method: "POST",
      });
      await fetchTree();
    } finally {
      setRecalcing(false);
    }
  };

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
          className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          onClick={() => setShowImport(true)}
        >
          导入
        </button>

        <button
          className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
          disabled={recalcing || selectedPeriod === null}
          onClick={handleRecalc}
        >
          {recalcing ? "计算中…" : "重算进度"}
        </button>
      </div>

      {/* OKR 树 */}
      {loading ? (
        <div className="py-12 text-center text-sm text-gray-400">加载中…</div>
      ) : objectives.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-400">暂无 OKR 数据</div>
      ) : (
        <div>
          {objectives.map((obj) => (
            <ObjectiveCard key={obj.id} obj={obj} depth={0} />
          ))}
        </div>
      )}

      {/* 导入向导 */}
      {showImport && (
        <ImportWizard
          importType="okr"
          onClose={() => {
            setShowImport(false);
            fetchTree();
          }}
        />
      )}
    </div>
  );
}
