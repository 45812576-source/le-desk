"use client";

import { memo, useState } from "react";
import type { ArchitectPhaseStatus } from "../types";
import { PHASE_THEME } from "../RouteStatusBar";
import { architectPhaseToThemeKey, ARCHITECT_MODE_LABELS } from "../utils";

// ─── ArchitectPhaseCard (Card A) ─────────────────────────────────────────────

export const ArchitectPhaseCard = memo(function ArchitectPhaseCard({
  phase,
}: {
  phase: ArchitectPhaseStatus;
}) {
  const themeKey = architectPhaseToThemeKey(phase.phase);
  const theme = PHASE_THEME[themeKey] || PHASE_THEME.phase1;
  const modeLabel = ARCHITECT_MODE_LABELS[phase.mode_source] || phase.mode_source;
  const [showDetail, setShowDetail] = useState(false);

  return (
    <div className={`mx-3 my-2 border-2 ${theme.border} ${theme.bg} text-[9px] font-mono`}>
      {/* Header: phase label + mode source */}
      <div className={`px-3 py-1.5 border-b ${theme.border} flex items-center gap-2`}>
        <span className={`${theme.accent} text-white px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-widest`}>
          {theme.label}
        </span>
        <span className="flex-1" />
        <span className="text-[7px] text-gray-400 dark:text-muted-foreground font-bold uppercase tracking-widest">
          ◇ {modeLabel}
        </span>
        {phase.ooda_round > 0 && (
          <span className="text-[7px] px-1 py-0.5 bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800 font-bold">
            OODA R{phase.ooda_round}
          </span>
        )}
      </div>

      {/* Body: goal (always visible) + collapsible detail */}
      <div className="px-3 py-2">
        {/* Transition hint — always visible as it's the actionable conclusion */}
        {phase.transition && (
          <div className={`${theme.text} text-[8px] font-bold mb-1`}>
            → {phase.transition}
          </div>
        )}

        {/* Collapsible detail */}
        {phase.upgrade_reason && (
          <>
            <button
              onClick={() => setShowDetail((v) => !v)}
              className="text-[8px] text-gray-400 hover:text-gray-600 dark:text-muted-foreground dark:hover:text-foreground transition-colors"
            >
              {showDetail ? "▾" : "▸"} 补充说明
            </button>
            {showDetail && (
              <div className="mt-1 pl-2 border-l-2 border-gray-200 dark:border-zinc-700 space-y-1">
                {phase.upgrade_reason && (
                  <div className="text-[8px] text-gray-400 dark:text-zinc-500">
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
