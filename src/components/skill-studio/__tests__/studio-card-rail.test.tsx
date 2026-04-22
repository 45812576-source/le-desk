import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

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
});
