import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { Step2ToolReview } from "../SandboxTestModal";
import type { SandboxSession } from "@/lib/types";

describe("Step2ToolReview", () => {
  const baseSession = {
    tool_review: [
      {
        tool_id: 101,
        tool_name: "天气工具",
        description: "查询实时天气",
        requiredness: "required",
        input_provenance: [],
      },
    ],
  } as SandboxSession;

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
    expect(screen.getByText("已标记为“必须调用”。")).toBeTruthy();

    fireEvent.click(radios[1]);
    expect(screen.getByText(/请说明无需调用的原因/)).toBeTruthy();

    fireEvent.click(radios[2]);
    expect(screen.getByText("已标记为“不确定（阻断）”，后续测试会按阻断处理。")).toBeTruthy();
  });
});
