"use client";

import { useMemo, type ReactNode } from "react";
import type { SkillDetail, SkillMemo, SandboxReport } from "@/lib/types";
import type { WorkflowStateData } from "./workflow-protocol";
import type { WorkbenchCard } from "./workbench";
import {
  MetricGrid,
  SummaryList,
  ActionGroup,
  buildAnalysisDescriptor,
  buildGovernanceDescriptor,
  buildReportDescriptor,
  buildWorkspaceActionSections,
  type WorkspaceAction,
  type WorkspaceGovernanceIntent,
} from "./StudioWorkspace";

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

function CardDetail({
  card,
  descriptor,
  actionSections,
}: {
  card: WorkbenchCard;
  descriptor: { description: string; metrics: Array<{ label: string; value: string; hint?: string | null; tone?: "cyan" | "amber" }>; summaries: Array<{ icon: ReactNode; label: string; text: string; tone?: "neutral" | "warn" | "success" }> };
  actionSections: Array<{ title: string; actions: WorkspaceAction[] }>;
}) {
  return (
    <div className="border-2 border-[#00A3C4] bg-white p-3 space-y-3">
      <div className="text-[10px] leading-relaxed text-gray-600">{descriptor.description}</div>
      <MetricGrid metrics={descriptor.metrics} />
      <SummaryList items={descriptor.summaries} />
      {actionSections.map((section) => (
        <ActionGroup key={section.title} title={section.title} actions={section.actions} />
      ))}
    </div>
  );
}

export function StudioCardRail({
  skill,
  workflowState,
  cards,
  activeCardId,
  memo,
  activeSandboxReport,
  governanceIntent,
  pendingGovernanceCount,
  pendingStagedEditCount,
  activeCardActions,
  onSelect,
  onOpenGovernancePanel,
  onOpenSandbox,
  onOpenPrompt,
  onFocusChat,
}: {
  skill: SkillDetail | null;
  workflowState: WorkflowStateData | null;
  cards: WorkbenchCard[];
  activeCardId: string | null;
  memo: SkillMemo | null;
  activeSandboxReport: SandboxReport | null;
  governanceIntent: WorkspaceGovernanceIntent;
  pendingGovernanceCount: number;
  pendingStagedEditCount: number;
  activeCardActions: WorkspaceAction[];
  onSelect: (cardId: string) => void;
  onOpenGovernancePanel: () => void;
  onOpenSandbox: () => void;
  onOpenPrompt: () => void;
  onFocusChat: (text: string) => void;
}) {
  const pendingCount = cards.filter((card) => card.status === "pending" || card.status === "active").length;
  const activeCard = cards.find((c) => c.id === activeCardId) ?? null;
  const pendingCards = useMemo(
    () => cards.filter((c) => c.id !== activeCardId && (c.status === "pending" || c.status === "active")),
    [cards, activeCardId],
  );

  const descriptor = useMemo(() => {
    if (!activeCard) return null;
    if (activeCard.mode === "analysis") {
      return buildAnalysisDescriptor({
        card: activeCard,
        workflowState,
        memo,
        pendingGovernanceCount,
        pendingStagedEditCount,
        pendingAnalysisCards: pendingCards.filter((c) => c.mode === "analysis").length,
        pendingExecutionCards: pendingCards.filter((c) => c.mode !== "analysis").length,
        nextPendingCard: pendingCards[0] ?? null,
      });
    }
    if (activeCard.mode === "governance") {
      return buildGovernanceDescriptor({
        skill,
        memo,
        activeSandboxReport,
        governanceIntent,
        pendingGovernanceCount,
        pendingStagedEditCount,
        pendingValidationCards: pendingCards.filter((c) => c.kind === "validation").length,
        pendingGovernanceCards: pendingCards.filter((c) => c.kind === "governance").length,
        nextPendingCard: pendingCards[0] ?? null,
      });
    }
    if (activeCard.mode === "report") {
      return buildReportDescriptor({
        memo,
        activeSandboxReport,
        pendingGovernanceCount,
        pendingStagedEditCount,
        nextPendingCard: pendingCards[0] ?? null,
      });
    }
    return null;
  }, [activeCard, workflowState, memo, skill, activeSandboxReport, governanceIntent, pendingGovernanceCount, pendingStagedEditCount, pendingCards]);

  const actionSections = useMemo(() => {
    if (!activeCard) return [];
    const kind = activeCard.mode === "analysis" ? "analysis"
      : activeCard.mode === "governance" ? "governance"
        : activeCard.mode === "report" ? "report"
          : null;
    if (!kind || kind === "report" && false) return [];
    return buildWorkspaceActionSections({
      kind: kind as "analysis" | "governance" | "report",
      workflowState,
      memo,
      nextPendingCard: pendingCards[0] ?? null,
      hasGovernanceQueue: pendingGovernanceCount > 0 || pendingStagedEditCount > 0,
      hasLatestTest: Boolean(activeSandboxReport || memo?.latest_test),
      onSelectWorkbenchCard: onSelect,
      onOpenPrompt: kind !== "report" ? onOpenPrompt : undefined,
      onOpenGovernancePanel,
      onOpenSandbox,
      onFocusChat,
      activeCardActions,
    });
  }, [activeCard, workflowState, memo, pendingCards, pendingGovernanceCount, pendingStagedEditCount, activeSandboxReport, onSelect, onOpenPrompt, onOpenGovernancePanel, onOpenSandbox, onFocusChat, activeCardActions]);

  return (
    <div className="flex-1 min-w-[320px] max-w-[480px] flex-shrink-0 border-r-2 border-[#1A202C] bg-[#F8FCFD] min-h-0 flex flex-col">
      <div className="flex-shrink-0 border-b-2 border-[#1A202C] px-4 py-3 bg-white">
        <div className="text-[8px] font-bold uppercase tracking-[0.24em] text-[#00A3C4]">Card Queue</div>
        <div className="mt-2 text-sm font-bold text-[#1A202C] truncate">
          {skill?.name || "未选择 Skill"}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 text-[9px] text-gray-500 font-mono">
          <span>{workflowState?.phase || "discover"}</span>
          <span>{pendingCount}/{cards.length} 待处理</span>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-2">
        {cards.length === 0 && (
          <div className="border border-dashed border-gray-300 bg-white px-3 py-4 text-[9px] text-gray-400 font-mono">
            当前还没有可聚焦卡片
          </div>
        )}

        {cards.map((card) => {
          const active = card.id === activeCardId;
          return (
            <div key={card.id} className="space-y-0">
              <button
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

              {/* Expanded detail for active card */}
              {active && descriptor && (
                <CardDetail
                  card={card}
                  descriptor={descriptor}
                  actionSections={actionSections}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
