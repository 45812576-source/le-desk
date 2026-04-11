"use client";

import type { StudioRouteInfo, PhaseProgress, ArchitectPhaseStatus } from "./types";
import { architectPhaseToThemeKey, ARCHITECT_PHASE_GOALS, FRAMEWORK_LABELS } from "./utils";

// ─── Skill Architect 三阶段配色 ──────────────────────────────────────────────
// Phase 1 问题定义(Why) = 紫色系 · Phase 2 要素拆解(What) = 蓝色系 · Phase 3 验证收敛(How) = 绿色系

const PHASE_THEME: Record<string, { border: string; bg: string; text: string; accent: string; label: string }> = {
  phase1: { border: "border-purple-300", bg: "bg-purple-50", text: "text-purple-700", accent: "bg-purple-600", label: "Phase 1 · 问题定义" },
  phase2: { border: "border-blue-300", bg: "bg-blue-50", text: "text-blue-700", accent: "bg-blue-600", label: "Phase 2 · 要素拆解" },
  phase3: { border: "border-emerald-300", bg: "bg-emerald-50", text: "text-emerald-700", accent: "bg-emerald-600", label: "Phase 3 · 验证收敛" },
  ooda: { border: "border-amber-300", bg: "bg-amber-50", text: "text-amber-700", accent: "bg-amber-600", label: "OODA · 迭代收敛" },
  ready: { border: "border-emerald-300", bg: "bg-emerald-50", text: "text-emerald-700", accent: "bg-emerald-600", label: "收敛完成" },
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

const PHASE_FRAMEWORKS: Record<string, string[]> = {
  phase_1_why: ["5_whys", "first_principles", "jtbd", "cynefin"],
  phase_2_what: ["mece_issue_tree", "scenario_planning", "value_chain"],
  phase_3_how: ["pyramid_principle", "pre_mortem", "red_team", "sensitivity_analysis", "zero_based"],
  ooda_iteration: ["ooda"],
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
  const goal = architectPhase ? ARCHITECT_PHASE_GOALS[architectPhase.phase] : null;
  const frameworks = architectPhase ? PHASE_FRAMEWORKS[architectPhase.phase] || [] : [];

  return (
    <div className="px-3 py-1.5 bg-[#F0F4F8] border-b border-gray-200 flex-shrink-0">
      {/* Row 1: session mode + phase dots */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[8px] font-bold uppercase tracking-widest text-[#00A3C4]">
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
          <span className="text-[7px] px-1 py-0.5 bg-amber-100 text-amber-700 border border-amber-300 font-bold">
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
                  done ? `${theme.accent} border-transparent` : active ? `${theme.border} ${theme.bg}` : "bg-gray-100 border-gray-300"
                }`}
                title={theme.label}
              />
            );
          })}
        </span>
      </div>

      {/* Row 2: phase goal + frameworks (only when architect phase is active) */}
      {architectPhase && (goal || frameworks.length > 0) && (
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {goal && (
            <span className={`text-[8px] ${activeTheme?.text || "text-gray-600"}`}>
              <span className="font-bold">目标：</span>{goal}
            </span>
          )}
          {frameworks.length > 0 && (
            <span className="flex items-center gap-1 ml-auto flex-wrap">
              <span className="text-[7px] font-bold text-gray-400">框架：</span>
              {frameworks.map((fw) => (
                <span
                  key={fw}
                  className={`px-1 py-0.5 text-[6px] font-bold ${activeTheme ? `${activeTheme.bg} ${activeTheme.text} border ${activeTheme.border}` : "bg-gray-100 text-gray-500 border border-gray-200"}`}
                >
                  {FRAMEWORK_LABELS[fw] || fw}
                </span>
              ))}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
