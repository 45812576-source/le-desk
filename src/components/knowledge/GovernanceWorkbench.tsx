"use client";

import React, { useCallback, useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import type { User } from "@/lib/types";
import type {
  GovernanceBlueprintLite,
  GovernanceGapOverview,
  GovernanceObjectGap,
  GovernanceSuggestionTaskLite,
} from "@/app/(app)/data/components/shared/types";

interface Props {
  currentUser: User | null;
  selectedKnowledgeId?: number | null;
  onSelectKnowledge?: (id: number) => void;
}

export default function GovernanceWorkbench({ currentUser, selectedKnowledgeId, onSelectKnowledge }: Props) {
  const [blueprint, setBlueprint] = useState<GovernanceBlueprintLite | null>(null);
  const [suggestions, setSuggestions] = useState<GovernanceSuggestionTaskLite[]>([]);
  const [gapOverview, setGapOverview] = useState<GovernanceGapOverview | null>(null);
  const [conflicts, setConflicts] = useState<Array<{ left_id: number; left_name: string; right_id: number; right_name: string; object_type_id: number; reason: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [repairingGapId, setRepairingGapId] = useState<string | null>(null);

  const [collapsed, setCollapsed] = useState(true);
  const isAdmin = currentUser?.role === "super_admin" || currentUser?.role === "dept_admin";

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const [bp, items] = await Promise.all([
        apiFetch<GovernanceBlueprintLite>("/knowledge-governance/blueprint"),
        apiFetch<GovernanceSuggestionTaskLite[]>("/knowledge-governance/suggestions?subject_type=knowledge&status=pending"),
      ]);
      setBlueprint(bp);
      setSuggestions(items);
      setGapOverview(await apiFetch<GovernanceGapOverview>("/knowledge-governance/gaps/overview"));
      setConflicts(await apiFetch("/knowledge-governance/object-conflicts"));
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  async function handleGapAction(gap: GovernanceObjectGap, action: GovernanceObjectGap["recommended_actions"][number]) {
    setRepairingGapId(`${gap.object_id}:${action.action}`);
    try {
      if (action.action === "merge_or_archive") {
        return;
      }
      await navigator.clipboard.writeText(
        `${gap.display_name}\n缺口: ${gap.reason}\n建议动作: ${action.label}\n对象ID: ${gap.object_id}\n动作码: ${action.action}`,
      );
      await load();
    } finally {
      setRepairingGapId(null);
    }
  }

  useEffect(() => { void load(); }, [load]);

  if (!isAdmin) return null;

  const objectives = blueprint?.objectives || [];
  const libraries = blueprint?.resource_libraries || [];

  return (
    <div className="border-t border-border bg-card">
      <div className="px-4 py-2 border-b border-border flex items-center gap-2 cursor-pointer select-none" onClick={() => setCollapsed(v => !v)}>
        <span className={`text-[8px] text-muted-foreground transition-transform ${collapsed ? "" : "rotate-90"}`}>▶</span>
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#0077B6]">治理审查台</span>
        <span className="text-[8px] text-muted-foreground">待审建议 {suggestions.length}</span>
        {gapOverview && (
          <span className="text-[8px] text-amber-600">
            缺口 {gapOverview.object_gaps.length} / 冲突 {gapOverview.conflict_count}
          </span>
        )}
        <button
          disabled={running}
          onClick={async () => {
            setRunning(true);
            try {
              await apiFetch("/knowledge-governance/knowledge/suggest-batch?limit=100", { method: "POST" });
              await load();
            } finally {
              setRunning(false);
            }
          }}
          className="ml-auto px-2 py-1 text-[9px] font-bold border border-border text-[#0077B6] hover:bg-muted disabled:opacity-50"
        >
          {running ? "扫描中..." : "批量生成建议"}
        </button>
      </div>

      {collapsed ? null : <div className="max-h-64 overflow-y-auto divide-y divide-border">
        {gapOverview && (gapOverview.object_gaps.length > 0 || gapOverview.conflict_count > 0) && (
          <div className="px-4 py-2 bg-muted border-b border-border space-y-1">
            {gapOverview.object_gaps.slice(0, 3).map((gap) => (
              <div key={`${gap.object_id}-${gap.gap_type}`} className="space-y-1 text-[8px] text-amber-700 dark:text-amber-300">
                <div>{gap.display_name}: {gap.reason}</div>
                {gap.recommended_actions.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {gap.recommended_actions.slice(0, 2).map((action) => (
                      <button
                        key={`${gap.object_id}-${action.action}`}
                        onClick={() => void handleGapAction(gap, action)}
                        className="px-1.5 py-0.5 border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900 font-bold"
                      >
                        {repairingGapId === `${gap.object_id}:${action.action}` ? "处理中..." : action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {gapOverview.conflict_count > 0 && (
              <div className="text-[8px] text-red-600">发现 {gapOverview.conflict_count} 组疑似重复对象</div>
            )}
            {conflicts.slice(0, 2).map((conflict) => (
              <div key={`${conflict.left_id}-${conflict.right_id}`} className="flex items-center gap-2 text-[8px] text-red-700 dark:text-red-400">
                <span className="truncate flex-1">{conflict.left_name} ⇄ {conflict.right_name}</span>
                <button
                  onClick={async () => {
                    await apiFetch("/knowledge-governance/objects/merge", {
                      method: "POST",
                      body: JSON.stringify({
                        source_object_id: conflict.right_id,
                        target_object_id: conflict.left_id,
                      }),
                    });
                    await load();
                  }}
                  className="px-2 py-0.5 border border-red-300 text-red-600 hover:bg-muted font-bold dark:text-red-400 dark:border-red-700"
                >
                  合并
                </button>
              </div>
            ))}
          </div>
        )}
        {loading && <div className="px-4 py-4 text-[9px] text-muted-foreground">加载中...</div>}
        {!loading && suggestions.length === 0 && (
          <div className="px-4 py-4 text-[9px] text-muted-foreground">暂无待审治理建议</div>
        )}
        {suggestions.map((item) => {
          const objective = objectives.find((x) => x.id === item.objective_id);
          const library = libraries.find((x) => x.id === item.resource_library_id);
          const isSelected = selectedKnowledgeId === item.subject_id;
          const reinforcementMeta = item.suggested_payload?.reinforcement_meta as
            | { strategy_group?: string; boost?: number; success_rate?: number | null; samples?: number }
            | undefined;
          return (
            <div key={item.id} className={`px-4 py-2 ${isSelected ? "bg-accent" : ""}`}>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onSelectKnowledge?.(item.subject_id)}
                  className="text-[10px] font-semibold text-[#0077B6] hover:underline"
                >
                  文档 #{item.subject_id}
                </button>
                <span className="text-[8px] px-1.5 py-0.5 rounded bg-muted border border-border text-amber-600 dark:text-amber-400">
                  {item.confidence || 0}%
                </span>
                <span className="text-[8px] text-muted-foreground">{objective?.name || "-"}</span>
                <span className="text-[8px] text-muted-foreground/50">/</span>
                <span className="text-[8px] text-muted-foreground">{library?.name || "-"}</span>
                <button
                  onClick={async () => {
                    await apiFetch("/knowledge-governance/apply", {
                      method: "POST",
                      body: JSON.stringify({
                        subject_type: "knowledge",
                        subject_id: item.subject_id,
                        objective_id: item.objective_id,
                        resource_library_id: item.resource_library_id,
                        governance_status: "aligned",
                        governance_note: item.reason || "批量审查采纳",
                      }),
                    });
                    await load();
                  }}
                  className="ml-auto px-2 py-0.5 text-[8px] font-bold border border-emerald-300 text-emerald-600 hover:bg-muted dark:text-emerald-400 dark:border-emerald-700"
                >
                  采纳
                </button>
                <button
                  onClick={async () => {
                    await apiFetch(`/knowledge-governance/suggestions/${item.id}/reject`, {
                      method: "POST",
                      body: JSON.stringify({ note: "治理审查台人工拒绝" }),
                    });
                    await load();
                  }}
                  className="px-2 py-0.5 text-[8px] font-bold border border-red-300 text-red-600 hover:bg-muted dark:text-red-400 dark:border-red-700"
                >
                  拒绝
                </button>
              </div>
              {item.reason && <div className="mt-1 text-[8px] text-muted-foreground">{item.reason}</div>}
              {reinforcementMeta && (
                <div className="mt-1 text-[8px] text-sky-700 dark:text-sky-300">
                  学习层: {reinforcementMeta.strategy_group || "-"} / 加权 {reinforcementMeta.boost || 0}
                  {typeof reinforcementMeta.success_rate === "number" ? ` / 命中率 ${(reinforcementMeta.success_rate * 100).toFixed(0)}%` : ""}
                  {reinforcementMeta.samples ? ` / 样本 ${reinforcementMeta.samples}` : ""}
                </div>
              )}
              {Array.isArray(item.suggested_payload?.missing_fields) && item.suggested_payload?.missing_fields.length > 0 && (
                <div className="mt-1 text-[8px] text-amber-700 dark:text-amber-300">
                  缺字段: {(item.suggested_payload.missing_fields as string[]).join("、")}
                </div>
              )}
              {Array.isArray(item.suggested_payload?.required_fields) && item.suggested_payload?.required_fields.length > 0 && (
                <div className="mt-1 text-[8px] text-slate-500">
                  基线字段: {(item.suggested_payload.required_fields as string[]).join("、")}
                </div>
              )}
            </div>
          );
        })}
      </div>}
    </div>
  );
}
