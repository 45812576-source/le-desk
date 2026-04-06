"use client";

import React, { useEffect, useMemo, useState } from "react";

import { apiFetch } from "@/lib/api";
import CollaborationBaseline from "./CollaborationBaseline";

import type {
  GovernanceBlueprintLite,
  GovernanceFeedbackEventLite,
  GovernanceGapOverview,
  GovernanceObjectGap,
  GovernanceStrategyStatLite,
  GovernanceSuggestionTaskLite,
  GovernanceObjectiveLite,
  GovernanceResourceLibraryLite,
} from "@/app/(app)/data/components/shared/types";

type SubjectTypeFilter = "all" | "knowledge" | "business_table";
type WorkbenchTab = "governance" | "baseline";

const OBJECTIVE_ORDER = ["company_common", "professional_capability", "outsource_intel", "business_line_execution"];

const OBJECTIVE_CLUSTER_LABELS: Record<string, string[]> = {
  company_common: ["战略基线", "组织机制", "标准件"],
  professional_capability: ["通用能力", "岗位胜任力", "岗位执行与案例"],
  outsource_intel: ["行业认知", "平台与增长", "竞争与风险"],
  business_line_execution: ["客户与资源", "岗位与流程", "交付与复盘"],
};

interface Props {
  mode?: "embedded" | "page";
  onSelectKnowledge?: (id: number) => void;
  onSelectTable?: (id: number) => void;
}

export default function GovernanceReviewWorkbench({
  mode = "embedded",
  onSelectKnowledge,
  onSelectTable,
}: Props) {
  const [blueprint, setBlueprint] = useState<GovernanceBlueprintLite | null>(null);
  const [suggestions, setSuggestions] = useState<GovernanceSuggestionTaskLite[]>([]);
  const [gapOverview, setGapOverview] = useState<GovernanceGapOverview | null>(null);
  const [strategyStats, setStrategyStats] = useState<GovernanceStrategyStatLite[]>([]);
  const [strategyRiskStats, setStrategyRiskStats] = useState<GovernanceStrategyStatLite[]>([]);
  const [feedbackEvents, setFeedbackEvents] = useState<GovernanceFeedbackEventLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [subjectType, setSubjectType] = useState<SubjectTypeFilter>("all");
  const [showFrozenOnly, setShowFrozenOnly] = useState(false);
  const [businessLineFilter, setBusinessLineFilter] = useState("");
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<WorkbenchTab>("governance");

  async function load() {
    setLoading(true);
    try {
      const [bp, sg, gaps] = await Promise.all([
        apiFetch<GovernanceBlueprintLite>("/knowledge-governance/blueprint"),
        apiFetch<GovernanceSuggestionTaskLite[]>("/knowledge-governance/suggestions?status=pending"),
        apiFetch<GovernanceGapOverview>("/knowledge-governance/gaps/overview"),
      ]);
      setBlueprint(bp);
      setSuggestions(sg);
      setGapOverview(gaps);
      setStrategyStats(await apiFetch<GovernanceStrategyStatLite[]>("/knowledge-governance/strategy-stats?limit=12"));
      setStrategyRiskStats(await apiFetch<GovernanceStrategyStatLite[]>("/knowledge-governance/strategy-risk-stats?limit=8"));
      setFeedbackEvents(await apiFetch<GovernanceFeedbackEventLite[]>("/knowledge-governance/feedback-events?limit=12"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const objectives = blueprint?.objectives || [];
  const libraries = blueprint?.resource_libraries || [];

  const filteredSuggestions = useMemo(() => {
    if (subjectType === "all") return suggestions;
    return suggestions.filter((item) => item.subject_type === subjectType);
  }, [suggestions, subjectType]);

  const visibleStrategyStats = useMemo(() => {
    return strategyStats.filter((item) => {
      if (showFrozenOnly && !item.is_frozen) return false;
      if (businessLineFilter && item.business_line !== businessLineFilter) return false;
      return true;
    });
  }, [strategyStats, showFrozenOnly, businessLineFilter]);

  const visibleStrategyRiskStats = useMemo(() => {
    return strategyRiskStats.filter((item) => {
      if (showFrozenOnly && !item.is_frozen) return false;
      if (businessLineFilter && item.business_line !== businessLineFilter) return false;
      return true;
    });
  }, [strategyRiskStats, showFrozenOnly, businessLineFilter]);

  const businessLineOptions = useMemo(
    () => Array.from(new Set([...strategyStats, ...strategyRiskStats].map((item) => item.business_line).filter(Boolean))) as string[],
    [strategyStats, strategyRiskStats],
  );

  const summaryClassName =
    mode === "page"
      ? "h-full flex flex-col bg-card"
      : "border-t border-border bg-card";

  return (
    <div className={summaryClassName}>
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <div className="flex items-center gap-0.5 mr-2">
          {(["governance", "baseline"] as WorkbenchTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-2 py-1 text-[8px] font-bold uppercase tracking-widest border ${
                activeTab === tab
                  ? "border-[#0077B6] text-[#0077B6] bg-accent"
                  : "border-border text-muted-foreground bg-card hover:bg-muted"
              }`}
            >
              {tab === "governance" ? "治理审查" : "协同基线"}
            </button>
          ))}
        </div>
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#0077B6]">{activeTab === "governance" ? "统一治理审查台" : "协同基线全局视图"}</span>
        <span className="text-[8px] text-gray-400">待审建议 {filteredSuggestions.length}</span>
        <span className="text-[8px] text-amber-600">对象缺口 {gapOverview?.object_gaps.length || 0}</span>
        <div className="ml-auto flex items-center gap-1">
          {(["all", "knowledge", "business_table"] as SubjectTypeFilter[]).map((item) => (
            <button
              key={item}
              onClick={() => setSubjectType(item)}
              className={`px-2 py-1 text-[8px] border font-bold ${
                subjectType === item
                  ? "border-[#0077B6] text-[#0077B6] bg-accent"
                  : "border-border text-muted-foreground bg-card"
              }`}
            >
              {item === "all" ? "全部" : item === "knowledge" ? "文档" : "数据表"}
            </button>
          ))}
          <button
            disabled={loading}
            onClick={() => void load()}
            className="px-2 py-1 text-[8px] font-bold border border-border text-muted-foreground bg-card hover:bg-muted disabled:opacity-50"
          >
            刷新
          </button>
          <button
            onClick={() => setShowFrozenOnly((v) => !v)}
            className={`px-2 py-1 text-[8px] font-bold border ${showFrozenOnly ? "border-red-300 bg-destructive/20 text-red-600 dark:text-red-400" : "border-border bg-card text-muted-foreground"}`}
          >
            仅冻结
          </button>
          <select
            value={businessLineFilter}
            onChange={(e) => setBusinessLineFilter(e.target.value)}
            className="px-2 py-1 text-[8px] border border-border bg-card text-muted-foreground"
          >
            <option value="">全部业务线</option>
            {businessLineOptions.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>
      </div>

      {activeTab === "baseline" && (
        <div className={mode === "page" ? "flex-1 min-h-0" : "max-h-80 overflow-y-auto"}>
          <CollaborationBaseline />
        </div>
      )}

      {activeTab === "governance" && <div className={mode === "page" ? "flex-1 min-h-0 overflow-auto" : "max-h-80 overflow-y-auto"}>
        {blueprint && (
          <section className="p-4 border-b border-border space-y-2 bg-card">
            <div className="text-[9px] font-bold uppercase tracking-widest text-slate-600">治理蓝图骨架</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {OBJECTIVE_ORDER.map((code) => {
                const objective = objectives.find((item) => item.code === code);
                const objectiveLibraries = libraries.filter((item) => item.objective_id === objective?.id);
                if (!objective) return null;
                return (
                  <div key={code} className="border border-border rounded bg-card px-3 py-2">
                    <div className="text-[10px] font-semibold text-gray-700">{objective.name}</div>
                    <div className="text-[8px] text-gray-400 mt-0.5">{objective.description || "暂无描述"}</div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(OBJECTIVE_CLUSTER_LABELS[code] || []).map((label) => (
                        <span key={label} className="px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-[8px] text-slate-600">
                          {label}
                        </span>
                      ))}
                    </div>
                    <div className="mt-2 text-[8px] text-gray-500">资源库 {objectiveLibraries.length}</div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
        <section className="p-4 border-b border-border space-y-2">
          <div className="text-[9px] font-bold uppercase tracking-widest text-amber-700">协同断点</div>
          {loading && <div className="text-[9px] text-gray-400">加载中...</div>}
          {!loading && (!gapOverview || gapOverview.object_gaps.length === 0) && (
            <div className="text-[9px] text-gray-400">暂无对象缺口</div>
          )}
          {gapOverview?.object_gaps.slice(0, mode === "page" ? 20 : 6).map((gap) => (
            <GapCard
              key={`${gap.object_id}-${gap.gap_type}`}
              gap={gap}
              actioningId={actioningId}
              onAction={async (action) => {
                setActioningId(`${gap.object_id}:${action.action}`);
                try {
                  await navigator.clipboard.writeText(
                    `${gap.display_name}\n缺口: ${gap.reason}\n动作: ${action.label}\n对象ID=${gap.object_id}\n动作码=${action.action}`,
                  );
                } finally {
                  setActioningId(null);
                }
              }}
            />
          ))}
        </section>

        <section className="p-4 border-b border-border space-y-2 bg-card">
          <div className="text-[9px] font-bold uppercase tracking-widest text-violet-700">策略效果榜</div>
          {visibleStrategyStats.length === 0 && <div className="text-[9px] text-gray-400">暂无学习样本</div>}
          <div className="space-y-1">
            {visibleStrategyStats.map((item) => (
              <div key={item.id} className="border border-border rounded bg-card px-3 py-2 text-[8px]">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-violet-700">{item.strategy_group}</span>
                  <span className="text-gray-500">{item.library_code || "-"}</span>
                  {item.business_line && (
                    <span className="px-1.5 py-0.5 rounded border border-violet-200 bg-violet-50 text-violet-600">
                      {item.business_line}
                    </span>
                  )}
                  <span className="ml-auto text-gray-500">reward {item.cumulative_reward}</span>
                </div>
                <div className="mt-1 text-gray-500">
                  命中率 {(item.success_rate * 100).toFixed(0)}% / 样本 {item.total_count} / 拒绝 {item.reject_count}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="p-4 border-b border-border space-y-2 bg-card">
          <div className="text-[9px] font-bold uppercase tracking-widest text-red-700">坏规则风险榜</div>
          {visibleStrategyRiskStats.length === 0 && <div className="text-[9px] text-gray-400">暂无高风险策略</div>}
          <div className="space-y-1">
            {visibleStrategyRiskStats.map((item) => (
              <div key={item.id} className="border border-red-200 rounded bg-card px-3 py-2 text-[8px]">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-red-700">{item.strategy_group}</span>
                  <span className="text-gray-500">{item.library_code || "-"}</span>
                  {item.business_line && (
                    <span className="px-1.5 py-0.5 rounded border border-red-200 bg-red-50 text-red-600">
                      {item.business_line}
                    </span>
                  )}
                  <span className="ml-auto text-red-600">reward {item.cumulative_reward}</span>
                  <button
                    onClick={async () => {
                      setActioningId(`freeze:${item.id}`);
                      try {
                        await apiFetch(`/knowledge-governance/strategy-stats/${item.id}/tune`, {
                          method: "POST",
                          body: JSON.stringify({ is_frozen: !item.is_frozen }),
                        });
                        await load();
                      } finally {
                        setActioningId(null);
                      }
                    }}
                    className="px-2 py-0.5 border border-red-300 text-red-600 hover:bg-muted font-bold"
                  >
                    {actioningId === `freeze:${item.id}` ? "处理中..." : item.is_frozen ? "解冻" : "冻结"}
                  </button>
                  <button
                    onClick={async () => {
                      setActioningId(`bias-down:${item.id}`);
                      try {
                        await apiFetch(`/knowledge-governance/strategy-stats/${item.id}/tune`, {
                          method: "POST",
                          body: JSON.stringify({ manual_bias: (item.manual_bias || 0) - 5 }),
                        });
                        await load();
                      } finally {
                        setActioningId(null);
                      }
                    }}
                    className="px-2 py-0.5 border border-gray-300 text-gray-600 hover:bg-gray-50 font-bold"
                  >
                    {actioningId === `bias-down:${item.id}` ? "处理中..." : "-5"}
                  </button>
                  <button
                    onClick={async () => {
                      setActioningId(`bias-up:${item.id}`);
                      try {
                        await apiFetch(`/knowledge-governance/strategy-stats/${item.id}/tune`, {
                          method: "POST",
                          body: JSON.stringify({ manual_bias: (item.manual_bias || 0) + 5 }),
                        });
                        await load();
                      } finally {
                        setActioningId(null);
                      }
                    }}
                    className="px-2 py-0.5 border border-gray-300 text-gray-600 hover:bg-gray-50 font-bold"
                  >
                    {actioningId === `bias-up:${item.id}` ? "处理中..." : "+5"}
                  </button>
                </div>
                <div className="mt-1 text-gray-500">
                  命中率 {(item.success_rate * 100).toFixed(0)}% / 样本 {item.total_count} / 拒绝 {item.reject_count} / bias {item.manual_bias || 0}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="p-4 border-b border-border space-y-2 bg-card">
          <div className="text-[9px] font-bold uppercase tracking-widest text-slate-700">最近反馈事件</div>
          {feedbackEvents.length === 0 && <div className="text-[9px] text-gray-400">暂无反馈事件</div>}
          <div className="space-y-1">
            {feedbackEvents.map((item) => (
              <div key={item.id} className="border border-border rounded bg-card px-3 py-2 text-[8px]">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-700">{item.event_type}</span>
                  <span className="text-gray-500">{item.subject_type} #{item.subject_id}</span>
                  <span className={`ml-auto ${item.reward_score >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    reward {item.reward_score}
                  </span>
                </div>
                {item.note && <div className="mt-1 text-gray-500">{item.note}</div>}
                <div className="mt-1 text-gray-400">{item.strategy_key}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="p-4 space-y-2">
          <div className="text-[9px] font-bold uppercase tracking-widest text-[#0077B6]">待审挂载建议</div>
          {!loading && filteredSuggestions.length === 0 && (
            <div className="text-[9px] text-gray-400">暂无待审建议</div>
          )}
          {filteredSuggestions.slice(0, mode === "page" ? 50 : 12).map((item) => (
            <SuggestionCard
              key={item.id}
              item={item}
              objectives={objectives}
              libraries={libraries}
              actioningId={actioningId}
              onSelectKnowledge={onSelectKnowledge}
              onSelectTable={onSelectTable}
              onApply={async () => {
                setActioningId(`suggestion:${item.id}`);
                try {
                  await apiFetch("/knowledge-governance/apply", {
                    method: "POST",
                    body: JSON.stringify({
                      subject_type: item.subject_type,
                      subject_id: item.subject_id,
                      objective_id: item.objective_id || null,
                      resource_library_id: item.resource_library_id || null,
                      governance_status: "aligned",
                      governance_note: item.reason || "统一治理审查台采纳",
                    }),
                  });
                  await load();
                } finally {
                  setActioningId(null);
                }
              }}
              onReject={async () => {
                setActioningId(`reject:${item.id}`);
                try {
                  await apiFetch(`/knowledge-governance/suggestions/${item.id}/reject`, {
                    method: "POST",
                    body: JSON.stringify({ note: "统一治理审查台人工拒绝" }),
                  });
                  await load();
                } finally {
                  setActioningId(null);
                }
              }}
            />
          ))}
        </section>
      </div>}
    </div>
  );
}

function GapCard({
  gap,
  actioningId,
  onAction,
}: {
  gap: GovernanceObjectGap;
  actioningId: string | null;
  onAction: (action: GovernanceObjectGap["recommended_actions"][number]) => Promise<void>;
}) {
  return (
    <div className="border border-border bg-muted rounded px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold text-amber-800">{gap.display_name}</span>
        <span className="text-[8px] px-1.5 py-0.5 rounded bg-card border border-border text-amber-700 dark:text-amber-400">
          {gap.gap_type}
        </span>
      </div>
      <div className="mt-1 text-[8px] text-amber-700">{gap.reason}</div>
      {gap.recommended_actions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {gap.recommended_actions.map((action) => (
            <button
              key={`${gap.object_id}-${action.action}`}
              onClick={() => void onAction(action)}
              className="px-2 py-0.5 text-[8px] font-bold border border-amber-300 text-amber-700 hover:bg-amber-100"
            >
              {actioningId === `${gap.object_id}:${action.action}` ? "处理中..." : action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SuggestionCard({
  item,
  objectives,
  libraries,
  actioningId,
  onSelectKnowledge,
  onSelectTable,
  onApply,
  onReject,
}: {
  item: GovernanceSuggestionTaskLite;
  objectives: GovernanceObjectiveLite[];
  libraries: GovernanceResourceLibraryLite[];
  actioningId: string | null;
  onSelectKnowledge?: (id: number) => void;
  onSelectTable?: (id: number) => void;
  onApply: () => Promise<void>;
  onReject: () => Promise<void>;
}) {
  const objective = objectives.find((x) => x.id === item.objective_id);
  const library = libraries.find((x) => x.id === item.resource_library_id);
  const selectLabel = item.subject_type === "knowledge" ? "打开文档" : item.subject_type === "business_table" ? "打开数据表" : "查看";
  const reinforcementMeta = item.suggested_payload?.reinforcement_meta as
    | { strategy_group?: string; boost?: number; success_rate?: number | null; samples?: number }
    | undefined;

  return (
    <div className="border border-border bg-card rounded px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold text-[#0077B6]">
          {item.subject_type === "knowledge" ? "文档" : item.subject_type === "business_table" ? "数据表" : item.subject_type} #{item.subject_id}
        </span>
        <span className="text-[8px] px-1.5 py-0.5 rounded bg-muted border border-border text-amber-600 dark:text-amber-400">
          {item.confidence || 0}%
        </span>
        <span className="text-[8px] text-gray-500">{objective?.name || "-"}</span>
        <span className="text-[8px] text-gray-300">/</span>
        <span className="text-[8px] text-gray-500">{library?.name || "-"}</span>
        <div className="ml-auto flex items-center gap-1">
          {item.subject_type === "knowledge" && onSelectKnowledge && (
            <button
              onClick={() => onSelectKnowledge(item.subject_id)}
              className="px-2 py-0.5 text-[8px] font-bold border border-gray-300 text-gray-600 hover:bg-gray-50"
            >
              {selectLabel}
            </button>
          )}
          {item.subject_type === "business_table" && onSelectTable && (
            <button
              onClick={() => onSelectTable(item.subject_id)}
              className="px-2 py-0.5 text-[8px] font-bold border border-gray-300 text-gray-600 hover:bg-gray-50"
            >
              {selectLabel}
            </button>
          )}
          <button
            onClick={() => void onApply()}
            className="px-2 py-0.5 text-[8px] font-bold border border-emerald-300 text-emerald-600 hover:bg-muted"
          >
            {actioningId === `suggestion:${item.id}` ? "采纳中..." : "采纳"}
          </button>
          <button
            onClick={() => void onReject()}
            className="px-2 py-0.5 text-[8px] font-bold border border-red-300 text-red-600 hover:bg-muted"
          >
            {actioningId === `reject:${item.id}` ? "拒绝中..." : "拒绝"}
          </button>
        </div>
      </div>
      {item.reason && <div className="mt-1 text-[8px] text-gray-500">{item.reason}</div>}
      {reinforcementMeta && (
        <div className="mt-1 text-[8px] text-sky-700">
          学习层: {reinforcementMeta.strategy_group || "-"} / 加权 {reinforcementMeta.boost || 0}
          {typeof reinforcementMeta.success_rate === "number" ? ` / 命中率 ${(reinforcementMeta.success_rate * 100).toFixed(0)}%` : ""}
          {reinforcementMeta.samples ? ` / 样本 ${reinforcementMeta.samples}` : ""}
        </div>
      )}
      {Array.isArray(item.suggested_payload?.missing_fields) && item.suggested_payload?.missing_fields.length > 0 && (
        <div className="mt-1 text-[8px] text-amber-700">
          缺字段: {(item.suggested_payload.missing_fields as string[]).join("、")}
        </div>
      )}
    </div>
  );
}
