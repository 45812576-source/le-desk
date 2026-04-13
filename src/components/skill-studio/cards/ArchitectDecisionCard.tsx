"use client";

import { memo } from "react";
import type { ArchitectOodaDecision, ArchitectReadyForDraft, ArchitectPhaseStatus } from "../types";
import { PHASE_THEME } from "../RouteStatusBar";

// ─── OODA Decision View ─────────────────────────────────────────────────────

const OODA_FIELDS: { key: keyof Pick<ArchitectOodaDecision, "observation" | "orientation" | "decision" | "delta_from_last">; label: string }[] = [
  { key: "observation", label: "观察" },
  { key: "orientation", label: "研判" },
  { key: "decision", label: "决策" },
  { key: "delta_from_last", label: "与上轮差异" },
];

export const OodaDecisionView = memo(function OodaDecisionView({
  decision,
  phaseStatus,
  onContinue,
}: {
  decision: ArchitectOodaDecision;
  phaseStatus: ArchitectPhaseStatus | null;
  onContinue: () => void;
}) {
  const theme = PHASE_THEME.ooda;
  const hasPhaseJump = decision.decision.includes("回调") || decision.decision.includes("Phase");

  return (
    <div className={`mx-3 my-2 border-2 ${theme.border} bg-white dark:bg-card text-[9px] font-mono`}>
      {/* Header */}
      <div className={`px-3 py-1.5 border-b ${theme.border} ${theme.bg} flex items-center gap-2`}>
        <span className={`${theme.accent} text-white px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-widest`}>
          ■ OODA · 第 {decision.ooda_round} 轮
        </span>
        {phaseStatus && phaseStatus.phase && (
          <span className="text-[7px] text-gray-400 dark:text-muted-foreground ml-auto">
            当前阶段：{phaseStatus.phase}
          </span>
        )}
      </div>

      {/* Body: 4-line OODA cycle */}
      <div className="px-3 py-2 space-y-1">
        {OODA_FIELDS.map(({ key, label }) => (
          <div key={key} className="flex gap-1.5">
            <span className={`font-bold ${theme.text} w-16 flex-shrink-0`}>{label}：</span>
            <span className="text-[#1A202C] dark:text-foreground">{decision[key]}</span>
          </div>
        ))}

        {/* Phase jump hint */}
        {hasPhaseJump && (
          <div className={`mt-1 pt-1 border-t ${theme.border}`}>
            <span className={`text-[8px] font-bold ${theme.text}`}>
              → 将跳转至对应阶段继续深化
            </span>
          </div>
        )}

        {/* CTA */}
        <div className="mt-2">
          <button
            onClick={onContinue}
            className={`px-3 py-1 text-[8px] font-bold uppercase tracking-widest text-white ${theme.accent} hover:opacity-80 transition-colors`}
          >
            继续推进
          </button>
        </div>
      </div>
    </div>
  );
});

// ─── Ready for Draft View ───────────────────────────────────────────────────

const PRIORITY_ORDER: Record<string, number> = { P0: 0, P1: 1, P2: 2 };

export const ReadyForDraftView = memo(function ReadyForDraftView({
  ready,
  onGenerateDraft,
}: {
  ready: ArchitectReadyForDraft;
  onGenerateDraft: () => void;
}) {
  const theme = PHASE_THEME.ready;
  const sortedElements = [...ready.key_elements].sort(
    (a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9),
  );

  return (
    <div className={`mx-3 my-2 border-2 ${theme.border} bg-white dark:bg-card text-[9px] font-mono`}>
      {/* Header */}
      <div className={`px-3 py-1.5 border-b ${theme.border} ${theme.bg} flex items-center gap-2`}>
        <span className={`${theme.accent} text-white px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-widest`}>
          ✓ 收敛完成
        </span>
        <span className={`${theme.text} font-bold text-[8px] uppercase tracking-widest`}>
          可以生成草稿
        </span>
      </div>

      {/* Body */}
      <div className="px-3 py-2 space-y-2">
        {/* Key elements */}
        <div>
          <span className="font-bold text-gray-500 dark:text-muted-foreground text-[8px]">关键要素：</span>
          <div className="mt-0.5 space-y-0.5">
            {sortedElements.map((el, i) => {
              const isP0 = el.priority === "P0";
              return (
                <div key={i} className="flex items-center gap-1.5">
                  <span className={`text-[7px] font-bold px-1 py-0.5 ${isP0 ? "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-200" : "bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-300"}`}>
                    {el.priority}
                  </span>
                  <span className="text-[#1A202C] dark:text-foreground">{el.name}</span>
                  <span className="text-[7px] text-gray-400 dark:text-zinc-500">(来源: {el.source_phase})</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Failure prevention */}
        {ready.failure_prevention.length > 0 && (
          <div>
            <span className="font-bold text-gray-500 dark:text-muted-foreground text-[8px]">失败预防：</span>
            <div className="mt-0.5 space-y-0.5">
              {ready.failure_prevention.map((item, i) => (
                <div key={i} className="flex items-start gap-1 text-amber-600 dark:text-amber-200">
                  <span className="flex-shrink-0">⚠</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Draft approach */}
        {ready.draft_approach && (
          <div>
            <span className="font-bold text-gray-500 dark:text-muted-foreground text-[8px]">生成方式：</span>
            <span className="text-[#1A202C] dark:text-foreground ml-1">{ready.draft_approach}</span>
          </div>
        )}

        {/* CTA */}
        <div className="mt-1">
          <button
            onClick={onGenerateDraft}
            className={`px-3 py-1.5 text-[8px] font-bold uppercase tracking-widest text-white ${theme.accent} hover:opacity-80 transition-colors`}
          >
            生成 Skill 草稿
          </button>
        </div>
      </div>
    </div>
  );
});
