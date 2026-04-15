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

  it("shows current run and expands archived run history", () => {
    render(
      <RouteStatusBar
        route={{
          session_mode: "optimize_existing_skill",
          route_reason: "test",
          active_assist_skills: [],
          next_action: "continue_chat",
          fast_status: "running",
          deep_status: "pending",
        }}
        activeRunId="run_current_123456"
        activeRunVersion={3}
        archivedRuns={[
          {
            runId: "run_old_123456",
            runVersion: 2,
            status: "superseded",
            supersededBy: "run_current_123456",
            archivedAt: "2026-04-15T12:00:00Z",
          },
        ]}
      />,
    );

    expect(screen.getByText(/当前 Run：v3/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /历史 Run：1/i }));
    expect(screen.getByText(/Run v2/i)).toBeTruthy();
    expect(screen.getByText(/已过期/)).toBeTruthy();
  });
});
