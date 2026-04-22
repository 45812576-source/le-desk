import { describe, expect, it } from "vitest";

import { resolveSkillStudioStreamOrchestration } from "../skill-studio-orchestration";

describe("skill studio orchestration", () => {
  it("decorates active architect card requests with card prompt context", () => {
    const resolved = resolveSkillStudioStreamOrchestration({
      method: "POST",
      targetPath: "/conversations/42/messages/stream",
      payload: {
        content: "我想做一个财务核算框架 Skill",
        selected_skill_id: 7,
        active_card_id: "create:architect:5whys",
        active_card_contract_id: "architect.phase.execute",
        active_card_title: "5 Whys 根因卡",
        active_card_mode: "analysis",
        active_card_target: { type: "analysis", key: "5whys" },
      },
    });

    expect(resolved?.payload.active_card_contract_id).toBe("architect.why.5whys");
    expect(resolved?.payload.studio_orchestration).toMatchObject({
      protocol_version: "card_queue_v1",
      active_card: {
        id: "create:architect:5whys",
        contractId: "architect.why.5whys",
      },
      card_prompt: {
        contractId: "architect.why.5whys",
      },
    });
    expect(resolved?.preludeEvents.map((event) => event.event)).toEqual(["card_patch", "artifact_patch"]);
  });

  it("leaves unrelated stream requests untouched", () => {
    const resolved = resolveSkillStudioStreamOrchestration({
      method: "POST",
      targetPath: "/conversations/42/messages/stream",
      payload: { content: "hello" },
    });

    expect(resolved).toBeNull();
  });
});
