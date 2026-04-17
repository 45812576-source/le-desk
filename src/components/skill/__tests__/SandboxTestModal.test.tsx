import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { Step2ToolReview } from "../SandboxTestModal";
import type { SandboxSession } from "@/lib/types";

describe("Step2ToolReview", () => {
  const baseSession = {
    session_id: 1,
    target_type: "tool",
    target_id: 101,
    target_version: 1,
    target_name: "天气工具",
    tester_id: 7,
    status: "draft",
    current_step: "tool_review",
    blocked_reason: null,
    detected_slots: [],
    tool_review: [
      {
        tool_id: 101,
        tool_name: "天气工具",
        description: "查询实时天气",
        confirmed: false,
        requiredness: "required",
        input_provenance: [],
      },
    ],
    permission_snapshot: null,
    theoretical_combo_count: null,
    semantic_combo_count: null,
    executed_case_count: null,
    quality_passed: null,
    usability_passed: null,
    anti_hallucination_passed: null,
    approval_eligible: null,
    report_id: null,
    created_at: null,
    completed_at: null,
  } satisfies SandboxSession;

  it("shows explicit selected feedback for every tool decision", () => {
    render(
      <Step2ToolReview
        session={baseSession}
        onSubmit={vi.fn()}
        loading={false}
      />,
    );

    const radios = screen.getAllByRole("radio");

    fireEvent.click(radios[0]);
    expect((radios[0] as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText("已标记为“必须调用”。")).toBeTruthy();

    fireEvent.click(radios[1]);
    expect((radios[1] as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText(/请说明无需调用的原因/)).toBeTruthy();

    fireEvent.click(radios[2]);
    expect((radios[2] as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText("已标记为“不确定（阻断）”，后续测试会按阻断处理。")).toBeTruthy();
    expect(screen.queryByText("√")).toBeNull();
  });
});
