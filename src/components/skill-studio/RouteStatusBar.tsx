"use client";

import type { StudioRouteInfo, PhaseProgress, ArchitectPhaseStatus } from "./types";
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

export function RouteStatusBar({
  route,
  phaseProgress = [],
  architectPhase,
}: {
  route: StudioRouteInfo | null;
  phaseProgress?: PhaseProgress[];
  architectPhase?: ArchitectPhaseStatus | null;
}) {
  if (!route) return null;
  const lastPhase = phaseProgress[phaseProgress.length - 1];

  // Derive current phase theme + goal + frameworks from architectPhase
  const themeKey = architectPhase ? architectPhaseToThemeKey(architectPhase.phase) : null;
  const activeTheme = themeKey ? PHASE_THEME[themeKey] : null;

  return (
    <div className="px-3 py-1.5 bg-[#F0F4F8] dark:bg-card border-b border-gray-200 dark:border-border flex-shrink-0">
      {/* Row 1: session mode + phase dots */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[8px] font-bold uppercase tracking-widest text-[#00A3C4] dark:text-cyan-300">
          {SESSION_MODE_ICONS[route.session_mode] || "◇"} {SESSION_MODE_LABELS[route.session_mode] || route.session_mode}
        </span>

        {/* Active phase label */}
        {activeTheme && (
          <span className={`text-[7px] font-bold uppercase tracking-widest px-1 py-0.5 ${activeTheme.text} ${activeTheme.bg} border ${activeTheme.border}`}>
            {activeTheme.label}
          </span>
        )}

        {/* OODA round badge */}
        {architectPhase && architectPhase.ooda_round > 0 && (
          <span className="text-[7px] px-1 py-0.5 bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800 font-bold">
            OODA R{architectPhase.ooda_round}
          </span>
        )}

        {/* 三阶段进度指示器 */}
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
      </div>

    </div>
  );
}
