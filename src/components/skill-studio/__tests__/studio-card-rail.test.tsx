import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StudioCardRail } from "../StudioCardRail";
import { useStudioStore } from "@/lib/studio-store";
import type { WorkspaceGovernanceIntent } from "../StudioWorkspace";
import type { WorkbenchCard } from "../workbench";

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

  it("renders governance blockers as a user-facing task summary before technical details", () => {
    const card: WorkbenchCard = {
      id: "governance-intent:1:mount_blocked",
      contractId: "governance.panel",
      title: "测试流被挂载门禁阻断",
      summary: "需要先完成：未确认权限声明、治理包已过期",
      status: "active",
      kind: "validation",
      mode: "governance",
      phase: "validation",
      source: "governance_panel",
      priority: 100,
      target: { type: "governance_panel", key: "1" },
    };
    const governanceIntent: WorkspaceGovernanceIntent = {
      mode: "mount_blocked",
      entrySource: "skill_studio_chat",
      conversationId: 10,
      triggerMessage: "执行分析",
      latestPlan: null,
      gateSummary: "需要先完成：未确认权限声明、治理包已过期",
      verdictReason: "前置条件未完成：未确认权限声明、治理包已过期",
      gateReasons: [
        {
          code: "missing_confirmed_declaration",
          title: "未确认权限声明",
          detail: "权限声明尚未生成或确认。",
          severity: "critical",
          step_id: "confirm_declaration",
          action: "generate_declaration",
        },
        {
          code: "stale_governance_bundle",
          title: "治理包已过期",
          detail: "治理包版本已过期，需要刷新治理状态。",
          severity: "warning",
          step_id: "refresh_governance",
          action: "refresh_governance",
        },
      ],
      guidedSteps: [
        {
          id: "confirm_declaration",
          order: 1,
          title: "生成并确认权限声明",
          detail: "生成权限声明文本并采纳挂载到 Skill。",
          status: "blocked",
          action: "generate_declaration",
          action_label: "生成声明",
        },
      ],
    };

    render(
      <StudioCardRail
        skill={null}
        workflowState={null}
        cards={[card]}
        activeCardId={card.id}
        memo={null}
        cardQueueLedger={null}
        activeSandboxReport={null}
        governanceIntent={governanceIntent}
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

    expect(screen.getByText("现在还不能测试")).toBeTruthy();
    expect(screen.getByText("先做这 2 件事")).toBeTruthy();
    expect(screen.getByText("让系统生成一段权限说明，然后点确认")).toBeTruthy();
    expect(screen.getByText("重新检查一次设置，确保用的是最新版")).toBeTruthy();
    expect(screen.getByText("点击下面的按钮，先完成「让系统生成一段权限说明，然后点确认」。")).toBeTruthy();
    expect(screen.getByRole("button", { name: "去处理这几件事" })).toBeTruthy();
    expect(screen.queryByText("Contract · governance.panel")).toBeNull();
    expect(screen.queryByText("Governance Queue")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "技术详情" }));
    expect(screen.getByText("Contract · governance.panel")).toBeTruthy();
    expect(screen.getByText("Governance Queue")).toBeTruthy();
  });
});
