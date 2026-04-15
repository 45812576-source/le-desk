import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { RouteStatusBar } from "../RouteStatusBar";

describe("RouteStatusBar", () => {
  it("shows persisted cold-start recovery badge", () => {
    render(
      <RouteStatusBar
        route={null}
        recoveryInfo={{
          source: "persisted",
          cold_start: true,
          recovered_at: "2026-04-15T05:12:00Z",
        }}
      />,
    );

    expect(screen.getByText(/恢复：冷启动恢复/)).toBeTruthy();
  });

  it("expands recovery details with source and ids", () => {
    render(
      <RouteStatusBar
        route={null}
        recoveryInfo={{
          source: "persisted",
          cold_start: true,
          recovered_at: "2026-04-15T05:12:00Z",
        }}
        recoverySkillId={12}
        recoveryConversationId={34}
        recoveryDraftImpact="已恢复草稿上下文，当前编辑器已有可继续编辑内容"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /恢复：冷启动恢复/i }));

    expect(screen.getByText(/来源：持久化事件冷启动回填/)).toBeTruthy();
    expect(screen.getByText(/Skill #12/)).toBeTruthy();
    expect(screen.getByText(/会话 #34/)).toBeTruthy();
    expect(screen.getByText(/草稿：已恢复草稿上下文/)).toBeTruthy();
  });
});
