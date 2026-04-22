import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StudioCardRail } from "../StudioCardRail";
import { useStudioStore } from "@/lib/studio-store";

describe("StudioCardRail", () => {
  beforeEach(() => {
    useStudioStore.getState().reset();
  });

  it("renders M5 orchestration error details and recovery hint", () => {
    useStudioStore.getState().setStudioError({
      kind: "studio_orchestration_error",
      message: "外部交接创建失败",
      step: "handoff",
      recoveryHint: "请重试创建交接记录，确认交接包完整后再发起外部实现。",
      activeCardId: "tool-card",
      autoAdvanced: false,
      retryable: true,
      payloadSnapshot: { target: "opencode" },
    });

    render(
      <StudioCardRail
        skill={null}
        workflowState={null}
        cards={[]}
        activeCardId={null}
        memo={null}
        cardQueueLedger={null}
        activeSandboxReport={null}
        governanceIntent={null}
        pendingGovernanceCount={0}
        pendingStagedEditCount={0}
        activeCardActions={[]}
        onSelect={() => {}}
        onOpenGovernancePanel={() => {}}
        onOpenSandbox={() => {}}
        onOpenPrompt={() => {}}
        onFocusChat={() => {}}
        onApplyDraft={() => {}}
        onDiscardDraft={() => {}}
        onConfirmSummary={() => {}}
        onDiscardSummary={() => {}}
        onConfirmSplit={() => {}}
        onDiscardSplit={() => {}}
        onStartFixTask={() => {}}
        onTargetedRetest={() => {}}
        onSubmitApproval={() => {}}
        onConfirmTool={() => {}}
        onExternalBuild={() => {}}
        onBindBack={() => {}}
      />,
    );

    expect(screen.getByText("外部交接创建失败")).toBeTruthy();
    expect(screen.getByText("失败步骤：handoff")).toBeTruthy();
    expect(screen.getByText("当前未自动继续推进。")).toBeTruthy();
    expect(screen.getByText("补救动作：请重试创建交接记录，确认交接包完整后再发起外部实现。")).toBeTruthy();
    expect(screen.getByText("当前卡片：tool-card")).toBeTruthy();
  });

  it("renders transition block details and prerequisite shortcuts", () => {
    const onSelect = vi.fn();
    useStudioStore.getState().setTransitionBlock({
      reason: "存在待确认修改，请先处理再继续。",
      blockedCardId: "card-1",
      prerequisiteCardIds: ["edit-1", "edit-2"],
    });

    render(
      <StudioCardRail
        skill={null}
        workflowState={null}
        cards={[]}
        activeCardId={null}
        memo={null}
        cardQueueLedger={null}
        activeSandboxReport={null}
        governanceIntent={null}
        pendingGovernanceCount={0}
        pendingStagedEditCount={0}
        activeCardActions={[]}
        onSelect={onSelect}
        onOpenGovernancePanel={() => {}}
        onOpenSandbox={() => {}}
        onOpenPrompt={() => {}}
        onFocusChat={() => {}}
        onApplyDraft={() => {}}
        onDiscardDraft={() => {}}
        onConfirmSummary={() => {}}
        onDiscardSummary={() => {}}
        onConfirmSplit={() => {}}
        onDiscardSplit={() => {}}
        onStartFixTask={() => {}}
        onTargetedRetest={() => {}}
        onSubmitApproval={() => {}}
        onConfirmTool={() => {}}
        onExternalBuild={() => {}}
        onBindBack={() => {}}
      />,
    );

    expect(screen.getByText("存在待确认修改，请先处理再继续。")).toBeTruthy();
    expect(screen.getByText("阻塞卡片：card-1")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "前往 edit-1" }));
    expect(onSelect).toHaveBeenCalledWith("edit-1");
  });

  it("renders reconcile conflict and timeline entries", () => {
    useStudioStore.getState().setReconcileConflict({
      message: "卡片状态冲突",
      conflictDetails: { source: "memo", target: "editor" },
    });
    useStudioStore.getState().appendTimelineEntry({
      id: "tl-1",
      type: "info",
      timestamp: "2026-04-22T10:00:00Z",
      message: "进入验证阶段",
      cardId: "card-9",
    });

    render(
      <StudioCardRail
        skill={null}
        workflowState={null}
        cards={[]}
        activeCardId={null}
        memo={null}
        cardQueueLedger={null}
        activeSandboxReport={null}
        governanceIntent={null}
        pendingGovernanceCount={0}
        pendingStagedEditCount={0}
        activeCardActions={[]}
        onSelect={() => {}}
        onOpenGovernancePanel={() => {}}
        onOpenSandbox={() => {}}
        onOpenPrompt={() => {}}
        onFocusChat={() => {}}
        onApplyDraft={() => {}}
        onDiscardDraft={() => {}}
        onConfirmSummary={() => {}}
        onDiscardSummary={() => {}}
        onConfirmSplit={() => {}}
        onDiscardSplit={() => {}}
        onStartFixTask={() => {}}
        onTargetedRetest={() => {}}
        onSubmitApproval={() => {}}
        onConfirmTool={() => {}}
        onExternalBuild={() => {}}
        onBindBack={() => {}}
      />,
    );

    expect(screen.getByText("卡片状态冲突")).toBeTruthy();
    expect(screen.getByText(/当前不会静默合并/)).toBeTruthy();
    expect(screen.getByText("Timeline")).toBeTruthy();
    expect(screen.getByText(/进入验证阶段/)).toBeTruthy();
  });
});
