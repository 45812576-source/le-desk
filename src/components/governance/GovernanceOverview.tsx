"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type {
  CollaborationBaselineResponse,
  GovernanceBaselineVersion,
  GovernanceGapOverview,
  GovernanceReviewStats,
  GovernanceFeedbackEventLite,
  GovernanceSuggestionTaskLite,
} from "@/app/(app)/data/components/shared/types";

export default function GovernanceOverview() {
  const [baseline, setBaseline] = useState<CollaborationBaselineResponse | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [reviewStats, setReviewStats] = useState<GovernanceReviewStats | null>(null);
  const [gapOverview, setGapOverview] = useState<GovernanceGapOverview | null>(null);
  const [feedbackEvents, setFeedbackEvents] = useState<GovernanceFeedbackEventLite[]>([]);
  const [baselineVersions, setBaselineVersions] = useState<GovernanceBaselineVersion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [bl, sg, rs, gaps, events, versions] = await Promise.all([
          apiFetch<CollaborationBaselineResponse>("/knowledge-governance/collaboration-baseline").catch(() => null),
          apiFetch<GovernanceSuggestionTaskLite[]>("/knowledge-governance/suggestions?status=pending").catch(() => []),
          apiFetch<GovernanceReviewStats>("/knowledge-governance/my-review-stats").catch(() => null),
          apiFetch<GovernanceGapOverview>("/knowledge-governance/gaps/overview").catch(() => null),
          apiFetch<GovernanceFeedbackEventLite[]>("/knowledge-governance/feedback-events?limit=10").catch(() => []),
          apiFetch<GovernanceBaselineVersion[]>("/knowledge-governance/baseline/versions").catch(() => []),
        ]);
        setBaseline(bl);
        setPendingCount(Array.isArray(sg) ? sg.length : 0);
        setReviewStats(rs);
        setGapOverview(gaps);
        setFeedbackEvents(Array.isArray(events) ? events : []);
        setBaselineVersions(Array.isArray(versions) ? versions : []);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-[10px] text-gray-400 animate-pulse uppercase tracking-widest">
        加载治理概览...
      </div>
    );
  }

  const coverageRate = baseline?.summary?.avg_field_coverage ?? 0;
  const gapCount = (gapOverview?.pending_suggestions ?? 0) + (gapOverview?.object_gaps?.length ?? 0);

  return (
    <div className="p-4 space-y-4">
      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard
          label="治理覆盖率"
          value={`${(coverageRate * 100).toFixed(0)}%`}
          sub={`${baseline?.summary?.total_libraries ?? 0} 个资源库`}
          color="text-emerald-600"
        />
        <StatCard
          label="待审建议"
          value={String(pendingCount)}
          sub="待人工审核"
          color="text-amber-600"
        />
        <StatCard
          label="本月 AI 自动生效"
          value={String(reviewStats?.ai_learned_this_month ?? 0)}
          sub={`预计减少审核 ${reviewStats?.estimated_reduction_next_month ?? 0}`}
          color="text-sky-600"
        />
        <StatCard
          label="治理缺口"
          value={String(gapCount)}
          sub={`对象缺口 ${gapOverview?.object_gaps?.length ?? 0} / 冲突 ${gapOverview?.conflict_count ?? 0}`}
          color="text-red-600"
        />
      </div>

      {/* 基线偏离告警 */}
      {(() => {
        const unconfirmed = baselineVersions.filter((v) => !v.confirmed_at && !v.is_active);
        const activeVersion = baselineVersions.find((v) => v.is_active);
        if (unconfirmed.length === 0) return null;
        return (
          <section className="border border-amber-300 rounded bg-amber-50 p-3 space-y-1">
            <div className="text-[9px] font-bold uppercase tracking-widest text-amber-700">基线偏离告警</div>
            <div className="text-[8px] text-amber-600">
              {unconfirmed.length} 个基线版本待确认
              {activeVersion && <span className="text-gray-500 ml-1">（当前基线: {activeVersion.version || "—"}）</span>}
            </div>
            {unconfirmed.slice(0, 3).map((v) => (
              <div key={v.id} className="flex items-center gap-2 text-[8px] border border-amber-200 rounded bg-white px-2 py-1">
                <span className="font-bold text-amber-800">{v.version || "—"}</span>
                <span className="text-gray-500">{v.change_type}</span>
                {v.stats_data && (
                  <>
                    <span className="text-emerald-600">覆盖率 {v.stats_data.coverage_rate ?? 0}%</span>
                    <span className="text-amber-600">待审 {v.stats_data.pending_suggestions ?? 0}</span>
                  </>
                )}
                <span className="ml-auto text-gray-400">{v.created_at ? new Date(v.created_at).toLocaleDateString() : ""}</span>
              </div>
            ))}
          </section>
        );
      })()}

      {/* 置信度分布（来自 baseline 版本数据，如果有的话） */}
      {baseline && baseline.libraries.length > 0 && (
        <section className="border border-border rounded bg-card p-3">
          <div className="text-[9px] font-bold uppercase tracking-widest text-slate-600 mb-2">资源库字段覆盖率分布</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {baseline.libraries.slice(0, 8).map((lib) => (
              <div key={lib.library_id} className="border border-border rounded px-2 py-1.5">
                <div className="text-[9px] font-semibold text-slate-700 truncate">{lib.library_name}</div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        lib.field_coverage >= 0.8 ? "bg-emerald-400" :
                        lib.field_coverage >= 0.5 ? "bg-amber-400" : "bg-red-400"
                      }`}
                      style={{ width: `${Math.min(lib.field_coverage * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-[8px] text-gray-500 flex-shrink-0">{(lib.field_coverage * 100).toFixed(0)}%</span>
                </div>
                <div className="text-[8px] text-gray-400 mt-0.5">文档 {lib.doc_count} / 数据表 {lib.table_count}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 最近反馈事件 */}
      <section className="border border-border rounded bg-card p-3">
        <div className="text-[9px] font-bold uppercase tracking-widest text-slate-600 mb-2">最近治理事件</div>
        {feedbackEvents.length === 0 ? (
          <div className="text-[9px] text-gray-400">暂无反馈事件</div>
        ) : (
          <div className="space-y-1">
            {feedbackEvents.map((ev) => (
              <div key={ev.id} className="flex items-center gap-2 text-[8px] border border-border rounded px-2 py-1.5">
                <span className={`font-bold ${ev.reward_score >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {ev.reward_score >= 0 ? "+" : ""}{ev.reward_score}
                </span>
                <span className="text-slate-600 font-semibold">{ev.event_type}</span>
                <span className="text-gray-400">{ev.subject_type} #{ev.subject_id}</span>
                <span className="text-gray-400 ml-auto">{ev.strategy_key}</span>
                {ev.created_at && (
                  <span className="text-gray-300 flex-shrink-0">{new Date(ev.created_at).toLocaleDateString()}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 审核统计 */}
      {reviewStats && (
        <section className="border border-border rounded bg-card p-3">
          <div className="text-[9px] font-bold uppercase tracking-widest text-slate-600 mb-2">审核效率</div>
          <div className="grid grid-cols-4 gap-3 text-center">
            <div>
              <div className="text-lg font-bold text-slate-700">{reviewStats.reviewed_this_month}</div>
              <div className="text-[8px] text-gray-400">本月人工审核</div>
            </div>
            <div>
              <div className="text-lg font-bold text-sky-600">{reviewStats.ai_learned_this_month}</div>
              <div className="text-[8px] text-gray-400">AI 学习生效</div>
            </div>
            <div>
              <div className="text-lg font-bold text-gray-500">{reviewStats.last_month_reviewed}</div>
              <div className="text-[8px] text-gray-400">上月人工审核</div>
            </div>
            <div>
              <div className="text-lg font-bold text-emerald-600">{reviewStats.estimated_reduction_next_month}</div>
              <div className="text-[8px] text-gray-400">预计下月减少</div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="border border-border rounded bg-card px-3 py-2">
      <div className="text-[8px] font-bold uppercase tracking-widest text-gray-500 mb-1">{label}</div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-[8px] text-gray-400 mt-0.5">{sub}</div>
    </div>
  );
}
