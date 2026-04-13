"use client";

import { memo } from "react";
import { X } from "lucide-react";
import type { GovernanceCardData, GovernanceAction } from "../types";

// ─── Generic Governance Card ─────────────────────────────────────────────────

const TYPE_STYLE: Record<string, { bg: string; border: string; accent: string; label: string }> = {
  route_status: { bg: "bg-[#F0F4F8] dark:bg-cyan-950/20", border: "border-[#00A3C4]/30 dark:border-cyan-900", accent: "text-[#00A3C4] dark:text-cyan-300", label: "路由" },
  assist_skills_status: { bg: "bg-purple-50 dark:bg-purple-950/30", border: "border-purple-200 dark:border-purple-800", accent: "text-purple-600 dark:text-purple-200", label: "辅助 Skill" },
  staged_edit: { bg: "bg-[#F0FFF9] dark:bg-emerald-950/25", border: "border-[#00CC99]/30 dark:border-emerald-900", accent: "text-[#00CC99] dark:text-emerald-300", label: "编辑建议" },
  adoption_prompt: { bg: "bg-amber-50 dark:bg-amber-950/25", border: "border-amber-200 dark:border-amber-800", accent: "text-amber-600 dark:text-amber-200", label: "待确认" },
  followup_prompt: { bg: "bg-blue-50 dark:bg-blue-950/25", border: "border-blue-200 dark:border-blue-800", accent: "text-blue-600 dark:text-blue-200", label: "后续建议" },
};

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-300",
  adopted: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-200",
  rejected: "bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-200",
  dismissed: "bg-gray-100 text-gray-400 line-through dark:bg-zinc-800 dark:text-zinc-500",
};

export const GovernanceCard = memo(function GovernanceCard({
  card,
  onAction,
  onDismiss,
}: {
  card: GovernanceCardData;
  onAction: (card: GovernanceCardData, action: GovernanceAction) => void;
  onDismiss?: (card: GovernanceCardData) => void;
}) {
  const style = TYPE_STYLE[card.type] || TYPE_STYLE.staged_edit;
  const isDone = card.status !== "pending";

  return (
    <div className={`mx-3 my-1.5 p-2.5 border text-[9px] font-mono ${style.bg} ${style.border} ${isDone ? "opacity-60" : ""}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className={`text-[7px] font-bold uppercase tracking-widest ${style.accent}`}>
            {style.label}
          </span>
          <span className="font-bold text-[#1A202C] dark:text-foreground text-[9px]">{card.title}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {isDone && (
            <span className={`text-[7px] px-1 py-0.5 font-bold uppercase ${STATUS_BADGE[card.status]}`}>
              {card.status === "adopted" ? "已采纳" : card.status === "rejected" ? "已拒绝" : "已忽略"}
            </span>
          )}
          {onDismiss && !isDone && (
            <button
              onClick={() => onDismiss(card)}
              className="text-gray-300 hover:text-gray-500 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors"
            >
              <X size={10} />
            </button>
          )}
        </div>
      </div>

      {/* Content summary */}
      {!!card.content.summary && (
        <p className="text-gray-500 dark:text-muted-foreground mb-1.5 text-[8px]">{String(card.content.summary)}</p>
      )}
      {!!card.content.reason && (
        <p className="text-gray-400 dark:text-zinc-500 text-[8px] mb-1.5">原因：{String(card.content.reason)}</p>
      )}

      {/* Action bar */}
      {!isDone && card.actions.length > 0 && (
        <AdoptionActionBar card={card} actions={card.actions} onAction={onAction} />
      )}
    </div>
  );
});

// ─── AdoptionActionBar ───────────────────────────────────────────────────────

const ACTION_STYLE: Record<string, string> = {
  adopt: "bg-[#00A3C4] text-white hover:bg-[#00D1FF]",
  reject: "bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700",
  view_diff: "bg-white text-[#00A3C4] border-[#00A3C4] hover:bg-[#F0FCFF] dark:bg-zinc-900 dark:text-cyan-300 dark:border-cyan-700 dark:hover:bg-cyan-950/30",
  refine: "bg-white text-purple-600 border-purple-300 hover:bg-purple-50 dark:bg-zinc-900 dark:text-purple-200 dark:border-purple-800 dark:hover:bg-purple-950/30",
};

const ACTION_LABEL: Record<string, string> = {
  adopt: "采纳",
  reject: "不采纳",
  view_diff: "查看修改",
  refine: "继续细化",
};

function AdoptionActionBar({
  card,
  actions,
  onAction,
}: {
  card: GovernanceCardData;
  actions: GovernanceAction[];
  onAction: (card: GovernanceCardData, action: GovernanceAction) => void;
}) {
  return (
    <div className="flex gap-1.5 mt-1">
      {actions.map((action) => (
        <button
          key={action.type}
          onClick={() => onAction(card, action)}
          className={`px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest border transition-colors ${
            ACTION_STYLE[action.type] || ACTION_STYLE.adopt
          }`}
        >
          {action.label || ACTION_LABEL[action.type] || action.type}
        </button>
      ))}
    </div>
  );
}
