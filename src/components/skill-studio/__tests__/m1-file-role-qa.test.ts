import { describe, expect, it } from "vitest";

import type { GovernanceCardData, StagedEdit } from "../types";
import { buildWorkbenchCards, doesWorkbenchCardTargetSavedFile, resolveNextPendingWorkbenchCardId, type GovernanceWorkbenchIntent } from "../workbench";

const hiddenGovernanceIntent: GovernanceWorkbenchIntent = {
  visible: false,
  skillId: null,
};

function buildCards(overrides?: {
  governanceCards?: GovernanceCardData[];
  stagedEdits?: StagedEdit[];
}) {
  return buildWorkbenchCards({
    governanceCards: overrides?.governanceCards ?? [],
    stagedEdits: overrides?.stagedEdits ?? [],
    selectedFile: null,
    selectedSkill: null,
    workflowState: null,
    memo: null,
    governanceIntent: hiddenGovernanceIntent,
    activeSandboxReport: null,
    prompt: "",
    hasPendingDraft: false,
    hasPendingSummary: false,
    hasPendingToolSuggestion: false,
    hasPendingFileSplit: false,
  });
}

describe("M1 QA · file role workbench wiring", () => {
  it("maps backend file role, handoff policy and queue window onto governance cards", () => {
    const cards = buildCards({
      governanceCards: [
        {
          id: "card-example",
          source: "session",
          type: "followup_prompt",
          title: "补充 example 文件",
          status: "pending",
          actions: [],
          content: {
            summary: "先完善 example 文件内容",
            target: { type: "source_file", key: "example-onboarding.md" },
            target_ref: "example-onboarding.md",
            file_role: "example",
            handoff_policy: "open_file_workspace",
            route_kind: "internal",
            destination: "file_workspace",
            return_to: "none",
            queue_window: {
              active_card_id: "card-example",
              visible_card_ids: ["card-example", "card-main"],
              backlog_count: 1,
              phase: "what",
              max_visible: 5,
              reveal_policy: "stage_gated",
            },
          },
        },
      ],
    });

    const card = cards.find((item) => item.id === "workflow-card:card-example");
    expect(card).toMatchObject({
      fileRole: "example",
      handoffPolicy: "open_file_workspace",
      routeKind: "internal",
      destination: "file_workspace",
      returnTo: "none",
      target: { type: "source_file", key: "example-onboarding.md" },
      queueWindow: {
        active_card_id: "card-example",
        visible_card_ids: ["card-example", "card-main"],
        backlog_count: 1,
        phase: "what",
        max_visible: 5,
        reveal_policy: "stage_gated",
      },
    });
  });

  it("surfaces staged edit file role metadata for tool cards", () => {
    const cards = buildCards({
      stagedEdits: [
        {
          id: "edit-tool",
          source: "session",
          fileType: "source_file",
          filename: "tools/search_tool.py",
          diff: [],
          status: "pending",
          file_role: "tool",
          handoff_policy: "open_development_studio",
          route_kind: "external",
          destination: "dev_studio",
          return_to: "bind_back",
        } as StagedEdit & {
          file_role: "tool";
          handoff_policy: "open_development_studio";
          route_kind: "external";
          destination: "dev_studio";
          return_to: "bind_back";
        },
      ],
    });

    const card = cards.find((item) => item.id === "staged-edit:edit-tool");
    expect(card).toMatchObject({
      fileRole: "tool",
      handoffPolicy: "open_development_studio",
      routeKind: "external",
      destination: "dev_studio",
      returnTo: "bind_back",
      target: { type: "source_file", key: "tools/search_tool.py" },
    });
  });

  it("maps M4 external_state onto visible external build status", () => {
    const cards = buildCards({
      governanceCards: [
        {
          id: "handoff-1",
          source: "session",
          type: "followup_prompt",
          title: "外部实现工具",
          status: "pending",
          actions: [],
          content: {
            summary: "OpenCode 外部实现中",
            file_role: "tool",
            handoff_policy: "open_opencode",
            route_kind: "external",
            destination: "opencode",
            return_to: "bind_back",
            external_state: "returned_waiting_bindback",
          },
        } as GovernanceCardData,
      ],
    });

    const card = cards.find((item) => item.id === "workflow-card:handoff-1");
    expect(card).toMatchObject({
      routeKind: "external",
      destination: "opencode",
      returnTo: "bind_back",
      externalBuildStatus: "returned_waiting_bindback",
    });
  });

  it("prefers the next pending card after the current active card", () => {
    expect(resolveNextPendingWorkbenchCardId([
      { id: "card-active", status: "active" },
      { id: "card-reviewed", status: "reviewing" },
      { id: "card-next", status: "pending" },
      { id: "card-later", status: "pending" },
    ] as never, "card-active")).toBe("card-next");
  });

  it("falls back to the first pending card when active card is missing", () => {
    expect(resolveNextPendingWorkbenchCardId([
      { id: "card-stale", status: "dismissed" },
      { id: "card-first", status: "pending" },
      { id: "card-second", status: "pending" },
    ] as never, "missing-card")).toBe("card-first");
  });

  it("matches prompt cards to SKILL.md saves", () => {
    expect(doesWorkbenchCardTargetSavedFile({
      id: "refine:draft-ready",
      mode: "file",
      target: { type: "prompt", key: "SKILL.md" },
    } as never, "SKILL.md")).toBe(true);
  });

  it("matches source-file cards only to the same file", () => {
    expect(doesWorkbenchCardTargetSavedFile({
      id: "fixing:file",
      mode: "file",
      target: { type: "source_file", key: "docs/checklist.md" },
    } as never, "docs/checklist.md")).toBe(true);
    expect(doesWorkbenchCardTargetSavedFile({
      id: "fixing:file",
      mode: "file",
      target: { type: "source_file", key: "docs/checklist.md" },
    } as never, "SKILL.md")).toBe(false);
  });
});
