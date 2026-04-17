import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { GovernanceCard } from "../GovernanceCard";

describe("GovernanceCard", () => {
  it("renders target, acceptance and evidence, and opens target on click", () => {
    const onOpenTarget = vi.fn();

    render(
      <GovernanceCard
        card={{
          id: "card_1",
          type: "followup_prompt",
          title: "补充结构化审计信息",
          content: {
            summary: "需要展示结构化证据",
            target_kind: "source_file",
            target_ref: "example.md",
            acceptance_rule: "卡片中能看到验收标准",
            evidence_snippets: ["命中原文片段一", "命中原文片段二"],
          },
          status: "pending",
          actions: [{ label: "查看", type: "view_diff" }],
        }}
        onAction={vi.fn()}
        onOpenTarget={onOpenTarget}
      />,
    );

    expect(screen.getAllByText("source_file")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "example.md" })).toBeInTheDocument();
    expect(screen.getByText("验收：卡片中能看到验收标准")).toBeInTheDocument();
    expect(screen.getByText("命中原文片段一")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "example.md" }));
    expect(onOpenTarget).toHaveBeenCalledTimes(1);
  });
});
