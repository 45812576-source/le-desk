"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import type {
  GovernanceStrategyStatLite,
  GovernanceFeedbackEventLite,
  StrategyImpact,
} from "@/app/(app)/data/components/shared/types";

type SubjectTypeFilter = "all" | "knowledge" | "business_table";

export default function StrategyStatsTab() {
  const [strategyStats, setStrategyStats] = useState<GovernanceStrategyStatLite[]>([]);
  const [riskStats, setRiskStats] = useState<GovernanceStrategyStatLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [subjectType, setSubjectType] = useState<SubjectTypeFilter>("all");
  const [showFrozenOnly, setShowFrozenOnly] = useState(false);
  const [businessLineFilter, setBusinessLineFilter] = useState("");
  const [actioningId, setActioningId] = useState<string | null>(null);

  // 反馈事件弹窗
  const [feedbackStrategyKey, setFeedbackStrategyKey] = useState<string | null>(null);
  const [feedbackEvents, setFeedbackEvents] = useState<GovernanceFeedbackEventLite[]>([]);
  const [loadingFeedback, setLoadingFeedback] = useState(false);

  // bias 编辑
  const [editingBiasId, setEditingBiasId] = useState<number | null>(null);
  const [biasValue, setBiasValue] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const stParam = subjectType !== "all" ? `&subject_type=${subjectType}` : "";
      const [stats, risk] = await Promise.all([
        apiFetch<GovernanceStrategyStatLite[]>(`/knowledge-governance/strategy-stats?limit=50${stParam}`),
        apiFetch<GovernanceStrategyStatLite[]>(`/knowledge-governance/strategy-risk-stats?limit=30${stParam}`),
      ]);
      setStrategyStats(stats);
      setRiskStats(risk);
    } finally {
      setLoading(false);
    }
  }, [subjectType]);

  useEffect(() => { void load(); }, [load]);

  const businessLineOptions = useMemo(
    () => Array.from(new Set([...strategyStats, ...riskStats].map((s) => s.business_line).filter(Boolean))) as string[],
    [strategyStats, riskStats],
  );

  const filterFn = useCallback((item: GovernanceStrategyStatLite) => {
    if (showFrozenOnly && !item.is_frozen) return false;
    if (businessLineFilter && item.business_line !== businessLineFilter) return false;
    return true;
  }, [showFrozenOnly, businessLineFilter]);

  const visibleStats = useMemo(() => strategyStats.filter(filterFn), [strategyStats, filterFn]);
  const visibleRisk = useMemo(() => riskStats.filter(filterFn), [riskStats, filterFn]);

  async function handleFreeze(item: GovernanceStrategyStatLite) {
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
  }

  async function handleBiasSubmit(id: number) {
    const val = parseFloat(biasValue);
    if (isNaN(val)) return;
    setActioningId(`bias:${id}`);
    try {
      await apiFetch(`/knowledge-governance/strategy-stats/${id}/tune`, {
        method: "POST",
        body: JSON.stringify({ manual_bias: val }),
      });
      setEditingBiasId(null);
      setBiasValue("");
      await load();
    } finally {
      setActioningId(null);
    }
  }

  async function openFeedbackEvents(strategyKey: string) {
    setFeedbackStrategyKey(strategyKey);
    setLoadingFeedback(true);
    try {
      const events = await apiFetch<GovernanceFeedbackEventLite[]>(
        `/knowledge-governance/feedback-events?strategy_key=${encodeURIComponent(strategyKey)}&limit=20`,
      );
      setFeedbackEvents(Array.isArray(events) ? events : []);
    } finally {
      setLoadingFeedback(false);
    }
  }

  return (
    <div className="p-4 space-y-4">
      {/* 过滤器 */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["all", "knowledge", "business_table"] as SubjectTypeFilter[]).map((st) => (
          <button
            key={st}
            onClick={() => setSubjectType(st)}
            className={`px-2 py-1 text-[8px] font-bold border ${
              subjectType === st ? "border-[#0077B6] text-[#0077B6] bg-accent" : "border-border text-muted-foreground bg-card"
            }`}
          >
            {st === "all" ? "全部" : st === "knowledge" ? "文档" : "数据表"}
          </button>
        ))}
        <button
          onClick={() => setShowFrozenOnly((v) => !v)}
          className={`px-2 py-1 text-[8px] font-bold border ${
            showFrozenOnly ? "border-red-300 bg-destructive/20 text-red-600" : "border-border bg-card text-muted-foreground"
          }`}
        >
          仅冻结
        </button>
        <select
          value={businessLineFilter}
          onChange={(e) => setBusinessLineFilter(e.target.value)}
          className="px-2 py-1 text-[8px] border border-border bg-card text-muted-foreground"
        >
          <option value="">全部业务线</option>
          {businessLineOptions.map((bl) => (
            <option key={bl} value={bl}>{bl}</option>
          ))}
        </select>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="px-2 py-1 text-[8px] font-bold border border-border text-muted-foreground bg-card hover:bg-muted disabled:opacity-50 ml-auto"
        >
          {loading ? "加载中..." : "刷新"}
        </button>
      </div>

      {/* 健康策略表 */}
      <section className="border border-border rounded bg-card">
        <div className="px-3 py-2 border-b border-border">
          <span className="text-[9px] font-bold uppercase tracking-widest text-violet-700">健康策略效果榜</span>
          <span className="text-[8px] text-gray-400 ml-2">{visibleStats.length} 条</span>
        </div>
        {visibleStats.length === 0 ? (
          <div className="p-3 text-[9px] text-gray-400">暂无学习样本</div>
        ) : (
          <div className="divide-y divide-border">
            {visibleStats.map((item) => (
              <StrategyRow
                key={item.id}
                item={item}
                variant="healthy"
                actioningId={actioningId}
                editingBiasId={editingBiasId}
                biasValue={biasValue}
                onFreeze={() => void handleFreeze(item)}
                onEditBias={() => { setEditingBiasId(item.id); setBiasValue(String(item.manual_bias ?? 0)); }}
                onBiasChange={setBiasValue}
                onBiasSubmit={() => void handleBiasSubmit(item.id)}
                onBiasCancel={() => setEditingBiasId(null)}
                onShowFeedback={() => void openFeedbackEvents(item.strategy_key)}
              />
            ))}
          </div>
        )}
      </section>

      {/* 风险策略表 */}
      <section className="border border-red-200 rounded bg-card">
        <div className="px-3 py-2 border-b border-red-200">
          <span className="text-[9px] font-bold uppercase tracking-widest text-red-700">坏规则风险榜</span>
          <span className="text-[8px] text-gray-400 ml-2">{visibleRisk.length} 条</span>
        </div>
        {visibleRisk.length === 0 ? (
          <div className="p-3 text-[9px] text-gray-400">暂无高风险策略</div>
        ) : (
          <div className="divide-y divide-border">
            {visibleRisk.map((item) => (
              <StrategyRow
                key={item.id}
                item={item}
                variant="risk"
                actioningId={actioningId}
                editingBiasId={editingBiasId}
                biasValue={biasValue}
                onFreeze={() => void handleFreeze(item)}
                onEditBias={() => { setEditingBiasId(item.id); setBiasValue(String(item.manual_bias ?? 0)); }}
                onBiasChange={setBiasValue}
                onBiasSubmit={() => void handleBiasSubmit(item.id)}
                onBiasCancel={() => setEditingBiasId(null)}
                onShowFeedback={() => void openFeedbackEvents(item.strategy_key)}
              />
            ))}
          </div>
        )}
      </section>

      {/* 反馈事件弹窗 */}
      {feedbackStrategyKey !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setFeedbackStrategyKey(null)}>
          <div className="bg-card border-2 border-[#1A202C] w-[560px] max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-2 border-b border-border flex items-center gap-2">
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-700">反馈事件明细</span>
              <span className="text-[8px] text-gray-400 font-mono">{feedbackStrategyKey}</span>
              <button
                onClick={() => setFeedbackStrategyKey(null)}
                className="ml-auto text-[10px] text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-auto p-3 space-y-1">
              {loadingFeedback ? (
                <div className="text-[9px] text-gray-400 animate-pulse">加载中...</div>
              ) : feedbackEvents.length === 0 ? (
                <div className="text-[9px] text-gray-400">暂无反馈事件</div>
              ) : (
                feedbackEvents.map((ev) => (
                  <div key={ev.id} className="border border-border rounded px-3 py-2 text-[8px]">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-700">{ev.event_type}</span>
                      <span className="text-gray-500">{ev.subject_type} #{ev.subject_id}</span>
                      <span className={`ml-auto font-bold ${ev.reward_score >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {ev.reward_score >= 0 ? "+" : ""}{ev.reward_score}
                      </span>
                    </div>
                    {ev.note && <div className="mt-1 text-gray-500">{ev.note}</div>}
                    {ev.created_at && <div className="mt-1 text-gray-300">{new Date(ev.created_at).toLocaleString()}</div>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── StrategyRow ──────────────────────────────────────────────────────────────

function StrategyRow({
  item,
  variant,
  actioningId,
  editingBiasId,
  biasValue,
  onFreeze,
  onEditBias,
  onBiasChange,
  onBiasSubmit,
  onBiasCancel,
  onShowFeedback,
}: {
  item: GovernanceStrategyStatLite;
  variant: "healthy" | "risk";
  actioningId: string | null;
  editingBiasId: number | null;
  biasValue: string;
  onFreeze: () => void;
  onEditBias: () => void;
  onBiasChange: (v: string) => void;
  onBiasSubmit: () => void;
  onBiasCancel: () => void;
  onShowFeedback: () => void;
}) {
  const [impact, setImpact] = useState<StrategyImpact | null>(null);
  const [loadingImpact, setLoadingImpact] = useState(false);

  async function loadImpact() {
    if (impact) return;
    setLoadingImpact(true);
    try {
      const data = await apiFetch<StrategyImpact>(`/knowledge-governance/strategy-stats/${item.id}/impact`);
      setImpact(data);
    } finally {
      setLoadingImpact(false);
    }
  }

  const accentColor = variant === "risk" ? "text-red-700" : "text-violet-700";
  const borderColor = variant === "risk" ? "border-red-200" : "border-border";

  return (
    <div className={`px-3 py-2 text-[8px] space-y-1`}>
      <div className="flex items-center gap-2">
        <span className={`font-semibold ${accentColor}`}>{item.strategy_group}</span>
        <span className="text-gray-500">{item.library_code || "-"}</span>
        {item.business_line && (
          <span className={`px-1.5 py-0.5 rounded border ${borderColor} ${variant === "risk" ? "bg-red-50 text-red-600" : "bg-violet-50 text-violet-600"}`}>
            {item.business_line}
          </span>
        )}
        {item.is_frozen && (
          <span className="px-1.5 py-0.5 rounded border border-blue-300 bg-blue-50 text-blue-600 font-bold">已冻结</span>
        )}
        <span className="ml-auto text-gray-500">reward {item.cumulative_reward}</span>
      </div>

      <div className="flex items-center gap-3 text-gray-500">
        <span>命中率 {(item.success_rate * 100).toFixed(0)}%</span>
        <span>样本 {item.total_count}</span>
        <span>拒绝 {item.reject_count}</span>
        <span>bias {item.manual_bias ?? 0}</span>
        {item.last_event_at && <span className="text-gray-300">最近 {new Date(item.last_event_at).toLocaleDateString()}</span>}
      </div>

      <div className="flex items-center gap-1 mt-1">
        <button
          onClick={onFreeze}
          className={`px-2 py-0.5 font-bold border ${item.is_frozen ? "border-emerald-300 text-emerald-600" : "border-red-300 text-red-600"} hover:bg-muted`}
        >
          {actioningId === `freeze:${item.id}` ? "处理中..." : item.is_frozen ? "解冻" : "冻结"}
        </button>

        {editingBiasId === item.id ? (
          <div className="flex items-center gap-1">
            <input
              type="number"
              step="0.1"
              value={biasValue}
              onChange={(e) => onBiasChange(e.target.value)}
              className="w-16 px-1 py-0.5 text-[8px] border border-border bg-white"
              onKeyDown={(e) => { if (e.key === "Enter") onBiasSubmit(); if (e.key === "Escape") onBiasCancel(); }}
              autoFocus
            />
            <button onClick={onBiasSubmit} className="px-2 py-0.5 font-bold border border-emerald-300 text-emerald-600 hover:bg-muted">
              {actioningId === `bias:${item.id}` ? "..." : "确认"}
            </button>
            <button onClick={onBiasCancel} className="px-2 py-0.5 font-bold border border-border text-gray-400 hover:bg-muted">取消</button>
          </div>
        ) : (
          <button onClick={onEditBias} className="px-2 py-0.5 font-bold border border-amber-300 text-amber-600 hover:bg-muted">
            调 bias
          </button>
        )}

        <button
          onClick={() => void loadImpact()}
          className="px-2 py-0.5 font-bold border border-amber-300 text-amber-700 hover:bg-muted"
        >
          {loadingImpact ? "加载中..." : "影响预估"}
        </button>

        <button
          onClick={onShowFeedback}
          className="px-2 py-0.5 font-bold border border-slate-300 text-slate-600 hover:bg-muted"
        >
          反馈明细
        </button>
      </div>

      {impact && (
        <div className="border border-amber-100 rounded bg-amber-50 px-2 py-2 space-y-1 mt-1">
          <div className="text-amber-800 font-bold">冻结影响预估</div>
          <div>影响待审建议 <span className="font-bold">{impact.affected_pending_count}</span> 条</div>
          <div>历史拒绝率 <span className="font-bold text-red-600">{impact.reject_rate}%</span></div>
          {impact.alternatives.length > 0 ? (
            <div className="mt-1">
              <div className="text-amber-700 font-bold">AI 推荐替代规则</div>
              {impact.alternatives.map((alt) => (
                <div key={alt.id} className="flex items-center gap-2 mt-0.5">
                  <span className="text-gray-700">{alt.library_code || alt.strategy_key}</span>
                  <span className="text-emerald-600">命中率 {alt.success_rate}%</span>
                  <span className="text-gray-400">样本 {alt.total_count}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-400">暂无替代规则建议</div>
          )}
        </div>
      )}
    </div>
  );
}
