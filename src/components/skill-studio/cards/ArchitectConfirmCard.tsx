"use client";

import { memo, useState } from "react";
import type { ArchitectPhaseSummary } from "../types";
import { PHASE_THEME } from "../RouteStatusBar";
import { architectPhaseToThemeKey } from "../utils";

// ─── Score bar colors (reuse from GovernanceTimeline pattern) ────────────────

const SCORE_BAR_COLORS: Record<string, string> = {
  high: "bg-green-500",
  medium: "bg-amber-400",
  low: "bg-red-400",
};

function confidenceLevel(score: number): "high" | "medium" | "low" {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

// ─── ArchitectConfirmCard (Card C) ───────────────────────────────────────────

export const ArchitectConfirmCard = memo(function ArchitectConfirmCard({
  summary,
  confirmed,
  onConfirm,
  onRevise,
}: {
  summary: ArchitectPhaseSummary;
  confirmed: boolean;
  onConfirm: () => void;
  onRevise: (note: string) => void;
}) {
  const [reviseMode, setReviseMode] = useState(false);
  const [reviseNote, setReviseNote] = useState("");

  const themeKey = architectPhaseToThemeKey(summary.phase);
  const theme = PHASE_THEME[themeKey] || PHASE_THEME.phase1;
  const level = confidenceLevel(summary.confidence);
  const barColor = SCORE_BAR_COLORS[level];

  // Confirmed compact mode
  if (confirmed) {
    return (
      <div className={`mx-3 my-1 px-2.5 py-1.5 border ${theme.border} ${theme.bg} text-[9px] font-mono opacity-60`}>
        <div className="flex items-center gap-2">
          <span className={`${theme.accent} text-white px-1 py-0.5 text-[6px] font-bold uppercase tracking-widest`}>
            ✓ {theme.label}
          </span>
          <span className={`${theme.text} font-bold text-[8px] flex-1`}>已确认</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`mx-3 my-2 border-2 ${theme.border} ${theme.bg} text-[9px] font-mono`}>
      {/* Header */}
      <div className={`px-3 py-1.5 border-b ${theme.border} flex items-center gap-2`}>
        <span className={`${theme.accent} text-white px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-widest`}>
          ✓ {theme.label}
        </span>
        <span className={`${theme.text} font-bold text-[8px] uppercase tracking-widest flex-1`}>
          阶段总结
        </span>
      </div>

      {/* Body */}
      <div className="px-3 py-2">
        {/* Summary text */}
        <p className="text-[#1A202C] dark:text-foreground mb-2">{summary.summary}</p>

        {/* Deliverables */}
        {summary.deliverables.length > 0 && (
          <div className="mb-2">
            <span className="font-bold text-gray-500 dark:text-muted-foreground text-[8px]">产出：</span>
            <div className="mt-0.5 space-y-0.5">
              {summary.deliverables.map((d, i) => (
                <div key={i} className={`flex items-center gap-1.5 ${theme.text}`}>
                  <span className="text-[7px]">✓</span>
                  <span>{d}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Confidence bar */}
        <div className="mb-2">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-bold text-gray-500 dark:text-muted-foreground text-[8px]">信心度</span>
            <div className="flex-1 h-1.5 bg-gray-200 dark:bg-zinc-800 relative">
              <div className={`h-full ${barColor}`} style={{ width: `${summary.confidence}%` }} />
            </div>
            <span className={`font-bold text-[8px] ${level === "high" ? "text-green-600" : level === "medium" ? "text-amber-600" : "text-red-500"}`}>
              {summary.confidence}/100
            </span>
          </div>
        </div>

        {/* Low confidence hint */}
        {!summary.ready_for_next && (
          <p className="text-[8px] text-amber-600 mb-2">
            信心度不足，建议补充更多信息后再确认
          </p>
        )}

        {/* CTA area */}
        {!reviseMode ? (
          <div className="flex gap-2 mt-1">
            <button
              onClick={onConfirm}
              className={`px-3 py-1 text-[8px] font-bold uppercase tracking-widest text-white transition-colors ${theme.accent} hover:opacity-80`}
            >
              {summary.ready_for_next ? "确认进入下一阶段" : "继续完善"}
            </button>
            <button
              onClick={() => setReviseMode(true)}
              className={`px-3 py-1 text-[8px] font-bold uppercase tracking-widest border ${theme.border} ${theme.text} bg-white/50 dark:bg-zinc-900/60 transition-colors`}
            >
              我想修正
            </button>
          </div>
        ) : (
          <div className="mt-1 space-y-1">
            <input
              type="text"
              value={reviseNote}
              onChange={(e) => setReviseNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && reviseNote.trim()) {
                  onRevise(reviseNote.trim());
                  setReviseMode(false);
                  setReviseNote("");
                }
              }}
              placeholder="说明需要修正的内容..."
              autoFocus
              className={`w-full px-2 py-1.5 border ${theme.border} bg-white dark:bg-zinc-950 text-[9px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#00D1FF]`}
            />
            <div className="flex gap-1">
              <button
                onClick={() => {
                  if (reviseNote.trim()) {
                    onRevise(reviseNote.trim());
                    setReviseMode(false);
                    setReviseNote("");
                  }
                }}
                disabled={!reviseNote.trim()}
                className={`px-2 py-0.5 text-[8px] font-bold uppercase ${theme.accent} text-white disabled:opacity-40`}
              >
                提交修正
              </button>
              <button
                onClick={() => { setReviseMode(false); setReviseNote(""); }}
                className="px-2 py-0.5 text-[8px] text-gray-400 hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300"
              >
                取消
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
