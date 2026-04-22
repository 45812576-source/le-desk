import { describe, expect, it } from "vitest";

import { resolveSkillStudioStreamOrchestration } from "../skill-studio-orchestration";

describe("skill studio orchestration M2 acceptance", () => {
  it("keeps main_prompt card context on stream requests", () => {
    const resolved = resolveSkillStudioStreamOrchestration({
      method: "POST",
      targetPath: "/conversations/42/messages/stream",
      payload: {
        content: "帮我改一下这个文件",
        selected_skill_id: 7,
        active_card_id: "card-main",
        active_card_contract_id: "confirm.staged_edit_review",
        active_card_title: "调整主 Prompt",
        active_card_mode: "file",
        active_card_target: { type: "prompt", key: "SKILL.md" },
        active_card_file_role: "main_prompt",
        active_card_handoff_policy: "open_file_workspace",
      },
    });

    expect(resolved?.payload.active_card_file_role).toBe("main_prompt");
    expect(resolved?.payload.active_card_handoff_policy).toBe("open_file_workspace");
    expect(resolved?.payload.active_card_contract_id).toBe("confirm.staged_edit_review");
    expect(resolved?.payload.studio_orchestration).toMatchObject({
      protocol_version: "card_queue_v1",
      active_card: {
        id: "card-main",
        contractId: "confirm.staged_edit_review",
        mode: "file",
        target: { type: "prompt", key: "SKILL.md" },
      },
      card_prompt: {
        contractId: "confirm.staged_edit_review",
      },
    });
  });

  it("keeps example card context on stream requests", () => {
    const resolved = resolveSkillStudioStreamOrchestration({
      method: "POST",
      targetPath: "/conversations/42/messages/stream",
      payload: {
        content: "帮我改一下这个文件",
        selected_skill_id: 7,
        active_card_id: "card-example",
        active_card_contract_id: "confirm.staged_edit_review",
        active_card_title: "补充示例",
        active_card_mode: "file",
        active_card_target: { type: "source_file", key: "example-basic.md" },
        active_card_file_role: "example",
        active_card_handoff_policy: "open_file_workspace",
        active_card_queue_window: {
          active_card_id: "card-example",
          visible_card_ids: ["card-example", "card-main"],
          backlog_count: 0,
          phase: "how",
          max_visible: 5,
          reveal_policy: "stage_gated",
        },
      },
    });

    expect(resolved?.payload.active_card_file_role).toBe("example");
    expect(resolved?.payload.active_card_handoff_policy).toBe("open_file_workspace");
    expect(resolved?.payload.active_card_queue_window).toMatchObject({
      active_card_id: "card-example",
      visible_card_ids: ["card-example", "card-main"],
    });
    expect(resolved?.payload.studio_orchestration).toMatchObject({
      active_card: {
        id: "card-example",
        mode: "file",
        target: { type: "source_file", key: "example-basic.md" },
      },
    });
  });

  it("keeps tool handoff context on stream requests", () => {
    const resolved = resolveSkillStudioStreamOrchestration({
      method: "POST",
      targetPath: "/conversations/42/messages/stream",
      payload: {
        content: "帮我实现这个工具",
        selected_skill_id: 7,
        active_card_id: "card-tool",
        active_card_contract_id: "confirm.staged_edit_review",
        active_card_title: "天气工具需求",
        active_card_mode: "file",
        active_card_target: { type: "source_file", key: "tool-weather.md" },
        active_card_file_role: "tool",
        active_card_handoff_policy: "open_opencode",
      },
    });

    expect(resolved?.payload.active_card_file_role).toBe("tool");
    expect(resolved?.payload.active_card_handoff_policy).toBe("open_opencode");
    expect(resolved?.payload.studio_orchestration).toMatchObject({
      active_card: {
        id: "card-tool",
        mode: "file",
        target: { type: "source_file", key: "tool-weather.md" },
      },
      card_prompt: {
        contractId: "confirm.staged_edit_review",
      },
    });
  });
});
