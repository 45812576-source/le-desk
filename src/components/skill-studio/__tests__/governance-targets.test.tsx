import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { GovernanceTimeline } from "../GovernanceTimeline";
import type { ChatMessage, GovernanceCardData } from "../types";

const baseMessages: ChatMessage[] = [];
const noop = vi.fn();

function renderTimeline(overrides: Partial<React.ComponentProps<typeof GovernanceTimeline>> = {}) {
  return render(
    <GovernanceTimeline
      messages={baseMessages}
      streaming={false}
      streamStage={null}
      governanceCards={[]}
      auditResult={null}
      pendingGovernanceActions={[]}
      onGovernanceAction={noop}
      onDismissGovernance={noop}
      onDismissAudit={noop}
      onAdoptGovernanceAction={noop}
      onQuickAction={noop}
      {...overrides}
    />,
  );
}

describe("GovernanceTimeline target links", () => {
  it("forwards governance card target clicks to the editor target handler", () => {
    const onOpenGovernanceTarget = vi.fn();
    const card: GovernanceCardData = {
      id: "audit-card-1",
      type: "followup_prompt",
      title: "修复导入审计问题",
      content: {
        summary: "审计发现 example 缺失验收标准",
        target_kind: "source_file",
        target_ref: "examples/audit.md",
        acceptance_rule: "点击卡片目标后打开对应 source file",
        evidence_snippets: ["examples/audit.md 中缺少验收说明"],
      },
      status: "pending",
      actions: [{ label: "查看", type: "view_diff" }],
    };

    renderTimeline({
      governanceCards: [card],
      onOpenGovernanceTarget,
    });

    expect(screen.getByText("验收：点击卡片目标后打开对应 source file")).toBeInTheDocument();
    expect(screen.getByText("examples/audit.md 中缺少验收说明")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "examples/audit.md" }));
    expect(onOpenGovernanceTarget).toHaveBeenCalledWith(card);
  });
});
