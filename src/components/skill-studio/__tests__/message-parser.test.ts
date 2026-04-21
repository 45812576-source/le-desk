import { describe, expect, it } from "vitest";
import { parseStructuredStudioMessage } from "../message-parser";

describe("parseStructuredStudioMessage", () => {
  it("uses draft placeholder only when a real studio_draft exists", () => {
    const text = [
      "```studio_draft",
      JSON.stringify({ name: "会计 Skill", system_prompt: "## 角色定义\n你是...", change_note: "初版" }),
      "```",
    ].join("\n");

    const parsed = parseStructuredStudioMessage(text);
    expect(parsed.draft?.name).toBe("会计 Skill");
    expect(parsed.cleanText).toBe("草稿已生成，请在右侧草稿卡中查看并决定是否应用。");
  });

  it("does not fake governance cards for architect phase summaries", () => {
    const text = [
      "```architect_phase_summary",
      JSON.stringify({
        phase: "phase_1_why",
        summary: "先明确业务事件边界",
        deliverables: ["根因", "场景", "边界"],
        confidence: 0.88,
        ready_for_next: true,
      }),
      "```",
    ].join("\n");

    const parsed = parseStructuredStudioMessage(text);
    expect(parsed.pendingPhaseSummary?.phase).toBe("phase_1_why");
    expect(parsed.pendingGovernanceActions).toHaveLength(0);
    expect(parsed.cleanText).toBe("阶段总结已生成，请在下方确认卡中查看并决定是否进入下一阶段。");
  });

  it("rehydrates governance actions from persisted structured blocks", () => {
    const text = [
      "```studio_governance_action",
      JSON.stringify({
        card_id: "gov-1",
        title: "补充边界条件",
        summary: "缺少失败分支处理",
        target: "system_prompt",
        reason: "当前草稿无法处理异常场景",
        risk_level: "medium",
        phase: "phase2",
        staged_edit: { ops: [{ type: "append", content: "\n## 异常处理\n..." }] },
      }),
      "```",
    ].join("\n");

    const parsed = parseStructuredStudioMessage(text);
    expect(parsed.pendingGovernanceActions).toHaveLength(1);
    expect(parsed.pendingGovernanceActions[0].title).toBe("补充边界条件");
    expect(parsed.cleanText).toBe("治理建议已生成，请在下方卡片中查看并决定是否采纳。");
  });

  it("extracts STUDIO_META quick replies and strips hidden comments", () => {
    const text = [
      "接下来是否继续创建 **example-basic.md** 来验证这些约束在实例中是否被正确执行？",
      "",
      "<!--STUDIO_META:{\"phase\":\"extract\",\"turn\":5,\"quick_replies\":[\"继续创建 example 文件\",\"先查看测试问题清单\",\"修改其他部分\"]}-->",
    ].join("\n");

    const parsed = parseStructuredStudioMessage(text);

    expect(parsed.cleanText).toBe("接下来是否继续创建 **example-basic.md** 来验证这些约束在实例中是否被正确执行？");
    expect(parsed.studioMeta?.phase).toBe("extract");
    expect(parsed.studioMeta?.turn).toBe(5);
    expect(parsed.studioMeta?.quickReplies).toEqual([
      "继续创建 example 文件",
      "先查看测试问题清单",
      "修改其他部分",
    ]);
  });
});
