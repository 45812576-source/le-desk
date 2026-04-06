"use client";

import React, { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

import type {
  GovernanceBaselineDiff,
  GovernanceBaselineVersion,
} from "@/app/(app)/data/components/shared/types";

const VERSION_TYPE_LABELS: Record<string, string> = {
  init: "基线初始化",
  governance_round: "治理轮次",
  steady_state: "稳态运行",
  incremental: "增量迭代",
  gap_fill: "缺口补入",
};

export default function BaselineVersionPanel() {
  const [versions, setVersions] = useState<GovernanceBaselineVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [diff, setDiff] = useState<GovernanceBaselineDiff | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [initializing, setInitializing] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch<GovernanceBaselineVersion[]>("/knowledge-governance/baseline/versions");
      setVersions(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function loadDiff(id: number) {
    setSelectedId(id);
    setDiffLoading(true);
    try {
      const data = await apiFetch<GovernanceBaselineDiff>(`/knowledge-governance/baseline/${id}/diff`);
      setDiff(data);
    } finally {
      setDiffLoading(false);
    }
  }

  async function handleInit() {
    setInitializing(true);
    try {
      await apiFetch("/knowledge-governance/baseline/init", {
        method: "POST",
        body: JSON.stringify({ seed_materials: [], org_context: {} }),
      });
      await load();
    } finally {
      setInitializing(false);
    }
  }

  async function handleConfirm(id: number) {
    setConfirming(true);
    try {
      await apiFetch(`/knowledge-governance/baseline/${id}/confirm`, { method: "POST" });
      await load();
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* 头部操作栏 */}
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#0077B6]">基线版本</span>
        <span className="text-[8px] text-gray-400">{versions.length} 个版本</span>
        <button
          onClick={() => void handleInit()}
          disabled={initializing}
          className="ml-auto px-3 py-1 text-[8px] font-bold border border-[#0077B6] text-[#0077B6] hover:bg-muted disabled:opacity-50"
        >
          {initializing ? "创建中..." : "创建基线快照"}
        </button>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="px-2 py-1 text-[8px] font-bold border border-border text-muted-foreground hover:bg-muted disabled:opacity-50"
        >
          刷新
        </button>
      </div>

      {loading && <div className="text-[9px] text-gray-400">加载中...</div>}
      {!loading && versions.length === 0 && (
        <div className="text-center py-8 text-[10px] text-gray-400">
          暂无基线版本，点击"创建基线快照"开始初始化
        </div>
      )}

      {/* 版本时间轴 */}
      <div className="space-y-2">
        {versions.map((v) => (
          <div
            key={v.id}
            className={`border rounded px-4 py-3 text-[9px] cursor-pointer transition-colors ${
              v.is_active
                ? "border-emerald-300 bg-emerald-50"
                : selectedId === v.id
                  ? "border-[#0077B6] bg-sky-50"
                  : "border-border bg-card hover:bg-muted"
            }`}
            onClick={() => void loadDiff(v.id)}
          >
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-800">{v.version || "—"}</span>
              <span className="px-1.5 py-0.5 rounded border border-gray-200 bg-gray-50 text-[8px] text-gray-600">
                {VERSION_TYPE_LABELS[v.version_type || ""] || v.version_type}
              </span>
              {v.is_active && (
                <span className="px-1.5 py-0.5 rounded border border-emerald-200 bg-emerald-100 text-[8px] text-emerald-700 font-bold">
                  当前基线
                </span>
              )}
              {!v.confirmed_at && (
                <span className="px-1.5 py-0.5 rounded border border-amber-200 bg-amber-50 text-[8px] text-amber-600">
                  待确认
                </span>
              )}
              <span className="ml-auto text-[8px] text-gray-400">
                {v.created_at ? new Date(v.created_at).toLocaleString("zh-CN") : ""}
              </span>
            </div>

            {/* 统计指标 */}
            {v.stats_data && (
              <div className="mt-2 flex gap-3 text-[8px]">
                <span>覆盖率 <b className="text-emerald-600">{v.stats_data.coverage_rate ?? 0}%</b></span>
                <span>已对齐 <b>{v.stats_data.aligned ?? 0}</b></span>
                <span>待审 <b className="text-amber-600">{v.stats_data.pending_suggestions ?? 0}</b></span>
                <span>未治理 <b className="text-gray-500">{v.stats_data.ungoverned ?? 0}</b></span>
                {v.stats_data.confidence_distribution && (
                  <span className="text-gray-400">
                    置信度 高{v.stats_data.confidence_distribution.high}/中{v.stats_data.confidence_distribution.mid}/低{v.stats_data.confidence_distribution.low}
                  </span>
                )}
              </div>
            )}

            {/* 确认按钮 */}
            {!v.is_active && !v.confirmed_at && (
              <div className="mt-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleConfirm(v.id);
                  }}
                  disabled={confirming}
                  className="px-3 py-1 text-[8px] font-bold border border-emerald-300 text-emerald-600 hover:bg-emerald-100 disabled:opacity-50"
                >
                  {confirming ? "确认中..." : "确认为当前基线"}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Diff 对比 */}
      {selectedId && diff && (
        <div className="border border-border rounded bg-card px-4 py-3 space-y-2">
          <div className="text-[9px] font-bold text-gray-700">
            版本对比：{diff.previous_version || "—"} → {diff.current_version || "—"}
          </div>
          {diffLoading && <div className="text-[8px] text-gray-400">加载中...</div>}

          {!diff.previous_version && (
            <div className="text-[9px] text-gray-500">首个版本，无可比对象</div>
          )}

          {diff.added_libraries.length > 0 && (
            <div className="text-[8px]">
              <span className="text-emerald-600 font-bold">+</span> 新增资源库：{diff.added_libraries.join(", ")}
            </div>
          )}
          {diff.removed_libraries.length > 0 && (
            <div className="text-[8px]">
              <span className="text-red-600 font-bold">-</span> 移除资源库：{diff.removed_libraries.join(", ")}
            </div>
          )}

          {diff.stats_diff && (
            <div className="grid grid-cols-3 gap-2 text-[8px]">
              <div className="border border-gray-100 rounded px-2 py-1">
                <div className="text-gray-500">覆盖率</div>
                <div>
                  {diff.stats_diff.coverage_rate.previous}% → {diff.stats_diff.coverage_rate.current}%
                  <span className={diff.stats_diff.coverage_rate.delta >= 0 ? "text-emerald-600 ml-1" : "text-red-600 ml-1"}>
                    {diff.stats_diff.coverage_rate.delta >= 0 ? "+" : ""}{diff.stats_diff.coverage_rate.delta}%
                  </span>
                </div>
              </div>
              <div className="border border-gray-100 rounded px-2 py-1">
                <div className="text-gray-500">已对齐</div>
                <div>{diff.stats_diff.aligned.previous} → {diff.stats_diff.aligned.current}</div>
              </div>
              <div className="border border-gray-100 rounded px-2 py-1">
                <div className="text-gray-500">待审</div>
                <div>{diff.stats_diff.pending_suggestions.previous} → {diff.stats_diff.pending_suggestions.current}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
