"use client";

import type { SkillDetail } from "@/lib/types";
import type { WorkbenchCard } from "./workbench";

const KIND_LABEL: Record<WorkbenchCard["kind"], string> = {
  architect: "架构卡",
  governance: "治理卡",
  validation: "验证卡",
  system: "系统卡",
  create: "创作卡",
  refine: "完善卡",
  fixing: "整改卡",
  release: "发布卡",
};

const STATUS_LABEL: Record<WorkbenchCard["status"], string> = {
  pending: "待处理",
  active: "进行中",
  reviewing: "待确认",
  adopted: "已采纳",
  rejected: "已拒绝",
  dismissed: "已关闭",
  stale: "已过期",
};

export function ActiveCardHeader({
  card,
  skill,
}: {
  card: WorkbenchCard | null;
  skill: SkillDetail | null;
}) {
  if (!card) {
    return (
      <div className="border-b-2 border-[#1A202C] bg-white px-5 py-4">
        <div className="text-[8px] font-bold uppercase tracking-[0.24em] text-[#00A3C4]">Active Card</div>
        <div className="mt-2 text-sm font-bold text-[#1A202C]">等待新任务进入工作台</div>
      </div>
    );
  }

  const sourceBits = [
    card.validationSource?.planId ? `Plan #${card.validationSource.planId}` : null,
    card.validationSource?.planVersion ? `v${card.validationSource.planVersion}` : null,
    card.validationSource?.sessionId ? `Session #${card.validationSource.sessionId}` : null,
    card.validationSource?.reportId ? `Report #${card.validationSource.reportId}` : null,
    card.validationSource?.entrySource ? String(card.validationSource.entrySource) : null,
  ].filter(Boolean);

  return (
    <div className="border-b-2 border-[#1A202C] bg-white px-5 py-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[8px] font-bold uppercase tracking-[0.24em] text-[#00A3C4]">Active Card</span>
        <span className="text-[8px] font-bold uppercase tracking-widest text-gray-400">{KIND_LABEL[card.kind]}</span>
        <span className="text-[8px] font-bold uppercase tracking-widest text-gray-400">{STATUS_LABEL[card.status]}</span>
        <span className="ml-auto text-[8px] font-mono text-gray-400">{card.phase}</span>
      </div>
      <div className="mt-2 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-base font-bold text-[#1A202C] line-clamp-2">{card.title}</div>
          <div className="mt-1 text-[10px] leading-relaxed text-gray-500">{card.summary}</div>
          {sourceBits.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {sourceBits.map((bit) => (
                <span
                  key={bit}
                  className="border border-[#1A202C]/15 bg-[#F8FCFD] px-2 py-0.5 text-[8px] font-mono text-[#00A3C4]"
                >
                  {bit}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="min-w-[180px] text-right">
          <div className="text-[8px] font-bold uppercase tracking-widest text-gray-400">当前 Skill</div>
          <div className="mt-1 text-[10px] font-bold text-[#1A202C] truncate">{skill?.name || "未选择"}</div>
          {card.target.key && (
            <>
              <div className="mt-2 text-[8px] font-bold uppercase tracking-widest text-gray-400">目标</div>
              <div className="mt-1 text-[10px] font-mono text-[#00A3C4] truncate">{card.target.key}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
