"use client";

import type { SkillDetail } from "@/lib/types";
import type { WorkflowStateData } from "./workflow-protocol";
import type { WorkbenchCard } from "./workbench";

const KIND_LABEL: Record<WorkbenchCard["kind"], string> = {
  architect: "架构",
  governance: "治理",
  validation: "验证",
  system: "系统",
};

const MODE_LABEL: Record<WorkbenchCard["mode"], string> = {
  analysis: "分析",
  file: "文件",
  report: "报告",
  governance: "治理",
};

const STATUS_LABEL: Record<WorkbenchCard["status"], string> = {
  pending: "待处理",
  active: "进行中",
  reviewing: "待确认",
  adopted: "已采纳",
  rejected: "已拒绝",
  dismissed: "已关闭",
};

export function StudioCardRail({
  skill,
  workflowState,
  cards,
  activeCardId,
  onSelect,
}: {
  skill: SkillDetail | null;
  workflowState: WorkflowStateData | null;
  cards: WorkbenchCard[];
  activeCardId: string | null;
  onSelect: (cardId: string) => void;
}) {
  const pendingCount = cards.filter((card) => card.status === "pending" || card.status === "active").length;

  return (
    <div className="w-[280px] flex-shrink-0 border-r-2 border-[#1A202C] bg-[#F8FCFD] min-w-0">
      <div className="border-b-2 border-[#1A202C] px-4 py-3 bg-white">
        <div className="text-[8px] font-bold uppercase tracking-[0.24em] text-[#00A3C4]">Card Queue</div>
        <div className="mt-2 text-sm font-bold text-[#1A202C] truncate">
          {skill?.name || "未选择 Skill"}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 text-[9px] text-gray-500 font-mono">
          <span>{workflowState?.phase || "discover"}</span>
          <span>{pendingCount}/{cards.length} 待处理</span>
        </div>
      </div>

      <div className="px-3 py-3 space-y-2 overflow-y-auto h-[calc(100%-88px)]">
        {cards.length === 0 && (
          <div className="border border-dashed border-gray-300 bg-white px-3 py-4 text-[9px] text-gray-400 font-mono">
            当前还没有可聚焦卡片
          </div>
        )}

        {cards.map((card) => {
          const active = card.id === activeCardId;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => onSelect(card.id)}
              className={`w-full text-left border-2 px-3 py-3 transition-colors ${
                active
                  ? "border-[#00A3C4] bg-[#ECFBFF] shadow-[4px_4px_0_0_#1A202C]"
                  : "border-[#1A202C]/15 bg-white hover:border-[#00A3C4]/60"
              }`}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[7px] font-bold uppercase tracking-widest text-[#00A3C4]">
                  {KIND_LABEL[card.kind]}
                </span>
                <span className="text-[7px] font-bold uppercase tracking-widest text-gray-400">
                  {MODE_LABEL[card.mode]}
                </span>
                <span className="ml-auto text-[7px] font-bold uppercase tracking-widest text-gray-400">
                  {STATUS_LABEL[card.status]}
                </span>
              </div>
              <div className="mt-2 text-[11px] font-bold text-[#1A202C] line-clamp-2">
                {card.title}
              </div>
              <div className="mt-1 text-[9px] leading-relaxed text-gray-500 line-clamp-3">
                {card.summary}
              </div>
              {card.target.key && (
                <div className="mt-2 text-[8px] font-mono text-[#00A3C4] truncate">
                  {card.target.key}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
