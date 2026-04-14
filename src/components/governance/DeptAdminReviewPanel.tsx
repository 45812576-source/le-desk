"use client";

import React, { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

import type {
  GovernanceCandidate,
  GovernanceReviewStats,
  GovernanceSimilarDecision,
  GovernanceSuggestionTaskLite,
  GovernanceObjectiveLite,
  GovernanceResourceLibraryLite,
  GovernanceBlueprintLite,
} from "@/app/(app)/data/components/shared/types";

export default function DeptAdminReviewPanel() {
  const [suggestions, setSuggestions] = useState<GovernanceSuggestionTaskLite[]>([]);
  const [blueprint, setBlueprint] = useState<GovernanceBlueprintLite | null>(null);
  const [reviewStats, setReviewStats] = useState<GovernanceReviewStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [sg, bp, stats] = await Promise.all([
        apiFetch<GovernanceSuggestionTaskLite[]>("/knowledge-governance/suggestions?status=pending&role_mode=dept_admin"),
        apiFetch<GovernanceBlueprintLite>("/knowledge-governance/blueprint"),
        apiFetch<GovernanceReviewStats>("/knowledge-governance/my-review-stats"),
      ]);
      setSuggestions(sg);
      setBlueprint(bp);
      setReviewStats(stats);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const objectives = blueprint?.objectives || [];
  const libraries = blueprint?.resource_libraries || [];

  return (
    <div className="h-full flex flex-col bg-card">
      {/* 学习统计 banner */}
      {reviewStats && (
        <div className="px-4 py-2 border-b border-border bg-emerald-50 flex items-center gap-4 text-[9px]">
          <span className="text-emerald-700 font-bold">本月你审了 {reviewStats.reviewed_this_month} 条</span>
          <span className="text-emerald-600">AI 从你的反馈中学到了 {reviewStats.ai_learned_this_month} 条</span>
          <span className="text-emerald-500">
            {reviewStats.estimated_reduction_next_month > 0
              ? `下月预计减少 ${reviewStats.estimated_reduction_next_month} 条审核`
              : "持续审核帮助 AI 学习"}
          </span>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="ml-auto px-2 py-0.5 text-[8px] font-bold border border-emerald-300 text-emerald-600 hover:bg-muted disabled:opacity-50"
          >
            刷新
          </button>
        </div>
      )}

      <div className="px-4 py-2 border-b border-border flex items-center gap-2">
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#0077B6]">分类纠偏台</span>
        <span className="text-[8px] text-gray-400">只展示 AI 置信度不足的项目，需要你帮助判断</span>
        <span className="text-[8px] text-amber-600 ml-auto">待审 {suggestions.length}</span>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-4 space-y-3">
        {loading && <div className="text-[9px] text-gray-400">加载中...</div>}
        {!loading && suggestions.length === 0 && (
          <div className="text-center py-12">
            <div className="text-[12px] text-emerald-600 font-bold mb-2">全部审完了!</div>
            <div className="text-[9px] text-gray-400">AI 置信度不足的条目已全部处理，暂无新的需要纠偏</div>
          </div>
        )}
        {suggestions.map((item) => (
          <DeptReviewCard
            key={item.id}
            item={item}
            objectives={objectives}
            libraries={libraries}
            actioningId={actioningId}
            onSelect={async (objectiveId, libraryId, reason) => {
              setActioningId(`apply:${item.id}`);
              try {
                await apiFetch("/knowledge-governance/apply", {
                  method: "POST",
                  body: JSON.stringify({
                    subject_type: item.subject_type,
                    subject_id: item.subject_id,
                    objective_id: objectiveId,
                    resource_library_id: libraryId,
                    governance_status: "aligned",
                    governance_note: reason,
                  }),
                });
                // 记录隐式反馈
                await apiFetch("/knowledge-governance/implicit-feedback", {
                  method: "POST",
                  body: JSON.stringify({
                    entry_id: item.subject_id,
                    signal_type: objectiveId === item.objective_id ? "employee_confirm" : "employee_correct",
                  }),
                });
                await load();
              } finally {
                setActioningId(null);
              }
            }}
          />
        ))}
      </div>
    </div>
  );
}

function DeptReviewCard({
  item,
  objectives,
  libraries,
  actioningId,
  onSelect,
}: {
  item: GovernanceSuggestionTaskLite;
  objectives: GovernanceObjectiveLite[];
  libraries: GovernanceResourceLibraryLite[];
  actioningId: string | null;
  onSelect: (objectiveId: number | null, libraryId: number | null, reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [selectedCandidate, setSelectedCandidate] = useState<number>(0); // 默认选第一个

  const candidates: GovernanceCandidate[] = (item as unknown as Record<string, unknown>).candidates_payload as GovernanceCandidate[] || [];
  const similarDecisions: GovernanceSimilarDecision[] = (item as unknown as Record<string, unknown>).similar_decisions as GovernanceSimilarDecision[] || [];

  const objective = objectives.find((x) => x.id === item.objective_id);
  const library = libraries.find((x) => x.id === item.resource_library_id);
  return (
    <div className="border border-border rounded bg-card px-4 py-3 space-y-2">
      <div className="flex items-center gap-2 text-[10px]">
        <span className="font-semibold text-[#0077B6]">
          {item.subject_type === "knowledge" ? "文档" : "数据表"} #{item.subject_id}
        </span>
        <span className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-600 text-[8px] font-bold">
          {item.confidence || 0}% 置信度
        </span>
        <span className="text-gray-500">{objective?.name || "-"} / {library?.name || "-"}</span>
      </div>

      {item.reason && (
        <div className="text-[9px] text-gray-600 border-l-2 border-amber-300 pl-2">
          AI 判断理由：{item.reason}
        </div>
      )}

      {/* AI 纠结的候选 */}
      {candidates.length > 0 && (
        <div className="space-y-1">
          <div className="text-[8px] font-bold text-gray-600 uppercase tracking-widest">AI 纠结的选项</div>
          {candidates.map((c, idx) => {
            const cLib = libraries.find((l) => l.code === c.library_code);
            const cObj = objectives.find((o) => o.code === c.objective_code);
            return (
              <div
                key={idx}
                onClick={() => setSelectedCandidate(idx)}
                className={`border rounded px-3 py-2 cursor-pointer text-[9px] ${
                  selectedCandidate === idx
                    ? "border-[#0077B6] bg-sky-50"
                    : "border-border hover:bg-muted"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold">{c.rank}.</span>
                  <span className="text-gray-700">{cObj?.name || c.objective_code} / {cLib?.name || c.library_code}</span>
                  <span className="text-amber-600">{c.confidence}%</span>
                </div>
                <div className="mt-0.5 text-gray-500">{c.reason}</div>
                {c.evidence.length > 0 && (
                  <div className="mt-0.5 flex gap-1 flex-wrap">
                    {c.evidence.map((e, i) => (
                      <span key={i} className="px-1 py-0.5 rounded border border-gray-200 bg-gray-50 text-[8px] text-gray-600">
                        {e}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 同类历史决策 */}
      {similarDecisions.length > 0 && (
        <div className="space-y-1">
          <div className="text-[8px] font-bold text-gray-600 uppercase tracking-widest">同类历史决策</div>
          <div className="flex gap-2 flex-wrap">
            {similarDecisions.map((d) => (
              <div key={d.id} className="text-[8px] px-2 py-1 border border-gray-100 rounded bg-gray-50">
                <span className="text-gray-600">#{d.subject_id}</span>
                <span className="ml-1 text-emerald-600">{d.confidence}%</span>
                {d.reason && <span className="ml-1 text-gray-400">{d.reason.slice(0, 30)}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 理由输入 + 确认 */}
      <div className="flex items-center gap-2">
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="选择理由（可选）"
          className="flex-1 text-[10px] border border-border px-2 py-1 focus:outline-none focus:border-[#00D1FF]"
        />
        <button
          onClick={() => {
            const selected = candidates[selectedCandidate];
            const objId = selected
              ? objectives.find((o) => o.code === selected.objective_code)?.id || item.objective_id
              : item.objective_id;
            const libId = selected
              ? libraries.find((l) => l.code === selected.library_code)?.id || item.resource_library_id
              : item.resource_library_id;
            void onSelect(objId || null, libId || null, reason || `纠偏确认：选择候选 ${selectedCandidate + 1}`);
          }}
          disabled={actioningId === `apply:${item.id}`}
          className="px-3 py-1 text-[8px] font-bold border border-emerald-300 text-emerald-600 hover:bg-muted disabled:opacity-50"
        >
          {actioningId === `apply:${item.id}` ? "处理中..." : "确认选择"}
        </button>
      </div>
    </div>
  );
}
