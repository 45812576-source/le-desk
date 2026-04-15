"use client";

import { useState } from "react";
import type { ArchivedStudioRun } from "@/lib/studio-store";
import type { StudioRouteInfo, PhaseProgress, ArchitectPhaseStatus, StudioRecoveryInfo } from "./types";
import { architectPhaseToThemeKey } from "./utils";

// ─── Skill Architect 三阶段配色 ──────────────────────────────────────────────
// Phase 1 问题定义(Why) = 紫色系 · Phase 2 要素拆解(What) = 蓝色系 · Phase 3 验证收敛(How) = 绿色系

const PHASE_THEME: Record<string, { border: string; bg: string; text: string; accent: string; label: string }> = {
  phase1: { border: "border-purple-300 dark:border-purple-800", bg: "bg-purple-50 dark:bg-purple-950/30", text: "text-purple-700 dark:text-purple-200", accent: "bg-purple-600 dark:bg-purple-500", label: "Phase 1 · 问题定义" },
  phase2: { border: "border-blue-300 dark:border-blue-800", bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-700 dark:text-blue-200", accent: "bg-blue-600 dark:bg-blue-500", label: "Phase 2 · 要素拆解" },
  phase3: { border: "border-emerald-300 dark:border-emerald-800", bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-200", accent: "bg-emerald-600 dark:bg-emerald-500", label: "Phase 3 · 验证收敛" },
  ooda: { border: "border-amber-300 dark:border-amber-800", bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-200", accent: "bg-amber-600 dark:bg-amber-500", label: "OODA · 迭代收敛" },
  ready: { border: "border-emerald-300 dark:border-emerald-800", bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-200", accent: "bg-emerald-600 dark:bg-emerald-500", label: "收敛完成" },
};

export { PHASE_THEME };

const SESSION_MODE_LABELS: Record<string, string> = {
  create_new_skill: "新建 Skill",
  optimize_existing_skill: "优化 Skill",
  audit_imported_skill: "审计导入 Skill",
};

const SESSION_MODE_ICONS: Record<string, string> = {
  create_new_skill: "◇",
  optimize_existing_skill: "◈",
  audit_imported_skill: "◆",
};

const NEXT_ACTION_LABELS: Record<string, string> = {
  collect_requirements: "继续收集需求",
  review_cards: "处理整改卡片",
  continue_chat: "继续对话",
  run_preflight: "运行 Preflight",
  run_sandbox: "运行 Sandbox",
  run_targeted_rerun: "运行局部重测",
  import_remediation: "导入整改",
  submit_approval: "提交审批",
};

const COMPLEXITY_LABELS: Record<string, { label: string; className: string }> = {
  simple: { label: "简单", className: "border-emerald-300 text-emerald-700 bg-emerald-50 dark:border-emerald-800 dark:text-emerald-200 dark:bg-emerald-950/30" },
  medium: { label: "中等 · 30s 首答", className: "border-blue-300 text-blue-700 bg-blue-50 dark:border-blue-800 dark:text-blue-200 dark:bg-blue-950/30" },
  high: { label: "高复杂 · 60s 首答", className: "border-amber-300 text-amber-700 bg-amber-50 dark:border-amber-800 dark:text-amber-200 dark:bg-amber-950/30" },
};

const STRATEGY_LABELS: Record<string, string> = {
  fast_only: "Fast Only",
  fast_then_deep: "Fast + Deep",
  deep_resume: "Deep Resume",
};

const LANE_STATUS_LABELS: Record<string, string> = {
  pending: "待运行",
  running: "运行中",
  completed: "已完成",
  failed: "失败",
  not_requested: "不需要",
  superseded: "已过期",
};

const RUN_STATUS_LABELS: Record<ArchivedStudioRun["status"], string> = {
  superseded: "已过期",
  completed: "已完成",
  failed: "失败",
  cancelled: "已取消",
};

function formatRecoveryBadge(recoveryInfo: StudioRecoveryInfo | null | undefined): string | null {
  if (!recoveryInfo || recoveryInfo.source === "none") return null;
  const sourceLabel = recoveryInfo.source === "memory"
    ? "内存快照"
    : recoveryInfo.cold_start
      ? "冷启动恢复"
      : "持久化快照";
  if (!recoveryInfo.recovered_at) {
    return `恢复：${sourceLabel}`;
  }
  const recoveredAt = new Date(recoveryInfo.recovered_at);
  if (Number.isNaN(recoveredAt.getTime())) {
    return `恢复：${sourceLabel}`;
  }
  const timeLabel = recoveredAt.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  return `恢复：${sourceLabel} · ${timeLabel}`;
}

function formatRecoverySourceLabel(recoveryInfo: StudioRecoveryInfo | null | undefined): string | null {
  if (!recoveryInfo || recoveryInfo.source === "none") return null;
  if (recoveryInfo.source === "memory") return "内存快照";
  return recoveryInfo.cold_start ? "持久化事件冷启动回填" : "持久化快照";
}

function formatRecoveryTimeLabel(recoveryInfo: StudioRecoveryInfo | null | undefined): string | null {
  if (!recoveryInfo?.recovered_at) return null;
  const recoveredAt = new Date(recoveryInfo.recovered_at);
  if (Number.isNaN(recoveredAt.getTime())) return null;
  return recoveredAt.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RouteStatusBar({
  route,
  phaseProgress = [],
  architectPhase,
  recoveryInfo,
  recoveryDraftImpact,
  recoverySkillId,
  recoveryConversationId,
  activeRunId,
  activeRunVersion,
  archivedRuns = [],
  onNextAction,
  nextActionRunning = false,
}: {
  route: StudioRouteInfo | null;
  phaseProgress?: PhaseProgress[];
  architectPhase?: ArchitectPhaseStatus | null;
  recoveryInfo?: StudioRecoveryInfo | null;
  recoveryDraftImpact?: string | null;
  recoverySkillId?: number | null;
  recoveryConversationId?: number | null;
  activeRunId?: string | null;
  activeRunVersion?: number | null;
  archivedRuns?: ArchivedStudioRun[];
  onNextAction?: (() => void) | null;
  nextActionRunning?: boolean;
}) {
  const [recoveryExpanded, setRecoveryExpanded] = useState(false);
  const [runExpanded, setRunExpanded] = useState(false);
  const recoveryBadge = formatRecoveryBadge(recoveryInfo);
  const recoverySourceLabel = formatRecoverySourceLabel(recoveryInfo);
  const recoveryTimeLabel = formatRecoveryTimeLabel(recoveryInfo);
  if (!route && !recoveryBadge && !activeRunId && archivedRuns.length === 0) return null;
  const lastPhase = phaseProgress[phaseProgress.length - 1];

  // Derive current phase theme + goal + frameworks from architectPhase
  const themeKey = architectPhase ? architectPhaseToThemeKey(architectPhase.phase) : null;
  const activeTheme = themeKey ? PHASE_THEME[themeKey] : null;
  const complexityInfo = route?.complexity_level ? COMPLEXITY_LABELS[route.complexity_level] : null;
  const strategyLabel = route?.execution_strategy ? STRATEGY_LABELS[route.execution_strategy] || route.execution_strategy : null;

  return (
    <div className="px-3 py-1.5 bg-[#F0F4F8] dark:bg-card border-b border-gray-200 dark:border-border flex-shrink-0">
      {/* Row 1: session mode + phase dots */}
      <div className="flex items-center gap-2 flex-wrap">
        {route && (
          <span className="text-[8px] font-bold uppercase tracking-widest text-[#00A3C4] dark:text-cyan-300">
            {SESSION_MODE_ICONS[route.session_mode] || "◇"} {SESSION_MODE_LABELS[route.session_mode] || route.session_mode}
          </span>
        )}

        {/* Active phase label */}
        {route && activeTheme && (
          <span className={`text-[7px] font-bold uppercase tracking-widest px-1 py-0.5 ${activeTheme.text} ${activeTheme.bg} border ${activeTheme.border}`}>
            {activeTheme.label}
          </span>
        )}

        {route && complexityInfo && (
          <span className={`text-[7px] font-bold uppercase tracking-widest px-1 py-0.5 border ${complexityInfo.className}`}>
            {complexityInfo.label}
          </span>
        )}

        {route && strategyLabel && (
          <span className="text-[7px] font-bold uppercase tracking-widest px-1 py-0.5 bg-white border border-slate-300 text-slate-600 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-300">
            {strategyLabel}
          </span>
        )}

        {route?.fast_status && (
          <span className="text-[7px] font-bold uppercase tracking-widest px-1 py-0.5 bg-white border border-[#00A3C4]/30 text-[#00A3C4] dark:bg-zinc-900 dark:border-cyan-900 dark:text-cyan-300">
            Fast：{LANE_STATUS_LABELS[route.fast_status] || route.fast_status}
          </span>
        )}

        {route?.deep_status && route.deep_status !== "not_requested" && (
          <span className="text-[7px] font-bold uppercase tracking-widest px-1 py-0.5 bg-white border border-purple-300 text-purple-700 dark:bg-zinc-900 dark:border-purple-800 dark:text-purple-200">
            Deep：{LANE_STATUS_LABELS[route.deep_status] || route.deep_status}
          </span>
        )}

        {activeRunId && (
          <span className="text-[7px] font-bold uppercase tracking-widest px-1 py-0.5 bg-white border border-slate-300 text-slate-700 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-200">
            当前 Run：v{activeRunVersion || 1} · {activeRunId.slice(0, 6)}
          </span>
        )}

        {archivedRuns.length > 0 && (
          <button
            type="button"
            onClick={() => setRunExpanded((prev) => !prev)}
            aria-expanded={runExpanded}
            className="text-[7px] font-bold uppercase tracking-widest px-1 py-0.5 bg-white border border-slate-300 text-slate-600 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-300"
            title={runExpanded ? "收起运行历史" : "查看运行历史"}
          >
            历史 Run：{archivedRuns.length} · {runExpanded ? "收起详情" : "查看详情"}
          </button>
        )}

        {route?.next_action && (
          <span className="flex items-center gap-1">
            <span className="text-[7px] font-bold uppercase tracking-widest px-1 py-0.5 bg-white border border-[#00A3C4]/30 text-[#00A3C4] dark:bg-zinc-900 dark:border-cyan-900 dark:text-cyan-300">
              下一步：{NEXT_ACTION_LABELS[route.next_action] || route.next_action}
            </span>
            {onNextAction && (
              <button
                type="button"
                onClick={onNextAction}
                disabled={nextActionRunning}
                className="text-[7px] font-bold uppercase tracking-widest px-1 py-0.5 border border-[#00CC99]/40 text-[#00CC99] bg-white disabled:opacity-50 dark:bg-zinc-900 dark:border-emerald-900 dark:text-emerald-300"
              >
                {nextActionRunning ? "执行中" : "执行"}
              </button>
            )}
          </span>
        )}

        {recoveryBadge && (
          <button
            type="button"
            onClick={() => setRecoveryExpanded((prev) => !prev)}
            aria-expanded={recoveryExpanded}
            className="text-[7px] font-bold uppercase tracking-widest px-1 py-0.5 bg-white border border-amber-300 text-amber-700 dark:bg-zinc-900 dark:border-amber-800 dark:text-amber-200"
            title={recoveryExpanded ? "收起恢复详情" : "查看恢复详情"}
          >
            {recoveryBadge} · {recoveryExpanded ? "收起详情" : "查看详情"}
          </button>
        )}

        {/* OODA round badge */}
        {route && architectPhase && architectPhase.ooda_round > 0 && (
          <span className="text-[7px] px-1 py-0.5 bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800 font-bold">
            OODA R{architectPhase.ooda_round}
          </span>
        )}

        {/* 三阶段进度指示器 */}
        {route && (
          <span className="flex items-center gap-0.5 ml-auto">
            {(["phase1", "phase2", "phase3"] as const).map((p) => {
              const done = phaseProgress.some((pp) => pp.completed_phase === p);
              const active = themeKey === p || lastPhase?.next_phase === p || (!lastPhase && !themeKey && p === "phase1");
              const theme = PHASE_THEME[p];
              return (
                <span
                  key={p}
                  className={`inline-block w-2 h-2 border ${
                    done ? `${theme.accent} border-transparent` : active ? `${theme.border} ${theme.bg}` : "bg-gray-100 border-gray-300 dark:bg-zinc-800 dark:border-zinc-700"
                  }`}
                  title={theme.label}
                />
              );
            })}
          </span>
        )}
      </div>

      {recoveryExpanded && recoveryBadge && (
        <div className="mt-1 flex items-center gap-2 flex-wrap text-[7px] uppercase tracking-widest text-amber-700 dark:text-amber-200">
          {recoverySourceLabel && (
            <span className="px-1 py-0.5 bg-amber-50 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800">
              来源：{recoverySourceLabel}
            </span>
          )}
          {recoveryTimeLabel && (
            <span className="px-1 py-0.5 bg-amber-50 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800">
              时间：{recoveryTimeLabel}
            </span>
          )}
          {typeof recoverySkillId === "number" && recoverySkillId > 0 && (
            <span className="px-1 py-0.5 bg-amber-50 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800">
              Skill #{recoverySkillId}
            </span>
          )}
          {typeof recoveryConversationId === "number" && recoveryConversationId > 0 && (
            <span className="px-1 py-0.5 bg-amber-50 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800">
              会话 #{recoveryConversationId}
            </span>
          )}
          {recoveryDraftImpact && (
            <span className="px-1 py-0.5 bg-amber-50 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800">
              草稿：{recoveryDraftImpact}
            </span>
          )}
        </div>
      )}

      {runExpanded && archivedRuns.length > 0 && (
        <div className="mt-1 flex items-center gap-2 flex-wrap text-[7px] uppercase tracking-widest text-slate-600 dark:text-zinc-300">
          {archivedRuns.map((run) => (
            <span
              key={`${run.runId}:${run.runVersion}`}
              className="px-1 py-0.5 bg-white border border-slate-300 dark:bg-zinc-900 dark:border-zinc-700"
            >
              Run v{run.runVersion} · {run.runId.slice(0, 6)} · {RUN_STATUS_LABELS[run.status] || run.status}
              {run.supersededBy ? ` · → ${run.supersededBy.slice(0, 6)}` : ""}
            </span>
          ))}
        </div>
      )}

    </div>
  );
}
