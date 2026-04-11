"use client";

import { memo, useState } from "react";
import type { ArchitectPhaseStatus } from "../types";
import { PHASE_THEME } from "../RouteStatusBar";
import { architectPhaseToThemeKey, ARCHITECT_PHASE_GOALS, ARCHITECT_MODE_LABELS, FRAMEWORK_LABELS } from "../utils";

// ─── Allowed frameworks per phase ────────────────────────────────────────────

const PHASE_FRAMEWORKS: Record<string, string[]> = {
  phase_1_why: ["5_whys", "first_principles", "jtbd", "cynefin"],
  phase_2_what: ["mece_issue_tree", "scenario_planning", "value_chain"],
  phase_3_how: ["pyramid_principle", "pre_mortem", "red_team", "sensitivity_analysis", "zero_based"],
  ooda_iteration: ["ooda"],
};

// ─── ArchitectPhaseCard (Card A) ─────────────────────────────────────────────

export const ArchitectPhaseCard = memo(function ArchitectPhaseCard({
  phase,
}: {
  phase: ArchitectPhaseStatus;
}) {
  const themeKey = architectPhaseToThemeKey(phase.phase);
  const theme = PHASE_THEME[themeKey] || PHASE_THEME.phase1;
  const goal = ARCHITECT_PHASE_GOALS[phase.phase] || "";
  const modeLabel = ARCHITECT_MODE_LABELS[phase.mode_source] || phase.mode_source;
  const frameworks = PHASE_FRAMEWORKS[phase.phase] || [];
  const [showDetail, setShowDetail] = useState(false);

  return (
    <div className={`mx-3 my-2 border-2 ${theme.border} ${theme.bg} text-[9px] font-mono`}>
      {/* Header: phase label + mode source */}
      <div className={`px-3 py-1.5 border-b ${theme.border} flex items-center gap-2`}>
        <span className={`${theme.accent} text-white px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-widest`}>
          {theme.label}
        </span>
        <span className="flex-1" />
        <span className="text-[7px] text-gray-400 font-bold uppercase tracking-widest">
          ◇ {modeLabel}
        </span>
        {phase.ooda_round > 0 && (
          <span className="text-[7px] px-1 py-0.5 bg-amber-100 text-amber-700 border border-amber-300 font-bold">
            OODA R{phase.ooda_round}
          </span>
        )}
      </div>

      {/* Body: goal (always visible) + collapsible detail */}
      <div className="px-3 py-2">
        <div className={`${theme.text} mb-1`}>
          <span className="font-bold text-[8px]">目标：</span>{goal}
        </div>

        {/* Transition hint — always visible as it's the actionable conclusion */}
        {phase.transition && (
          <div className={`${theme.text} text-[8px] font-bold mb-1`}>
            → {phase.transition}
          </div>
        )}

        {/* Collapsible frameworks + detail */}
        {(frameworks.length > 0 || phase.upgrade_reason) && (
          <>
            <button
              onClick={() => setShowDetail((v) => !v)}
              className="text-[8px] text-gray-400 hover:text-gray-600 transition-colors"
            >
              {showDetail ? "▾" : "▸"} 框架与细节
            </button>
            {showDetail && (
              <div className="mt-1 pl-2 border-l-2 border-gray-200 space-y-1">
                {frameworks.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="font-bold text-gray-500 text-[8px]">框架：</span>
                    {frameworks.map((fw) => (
                      <span
                        key={fw}
                        className={`px-1 py-0.5 text-[7px] ${theme.bg} ${theme.text} border ${theme.border}`}
                      >
                        {FRAMEWORK_LABELS[fw] || fw}
                      </span>
                    ))}
                  </div>
                )}
                {phase.upgrade_reason && (
                  <div className="text-[8px] text-gray-400">
                    升级原因：{phase.upgrade_reason}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
});
