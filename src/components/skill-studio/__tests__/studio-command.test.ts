import { describe, expect, it } from "vitest";
import type { SkillMemoTask } from "@/lib/types";

import {
  buildFixTaskStudioCommand,
  coerceRequiredStructuredResponseText,
  commandTelemetryPayload,
  selectStudioDiffForCommand,
  shouldRunNaturalLanguageResolvers,
} from "../studio-command";

function makeTask(overrides: Partial<SkillMemoTask> = {}): SkillMemoTask {
  return {
    id: "fix-input-slots",
    title: "修复输入槽位定义",
    type: "fix",
    status: "todo",
    priority: "high",
    description: "需要绑定知识库/数据表来源，但必须输出 studio_diff",
    target_files: [],
    acceptance_rule: { mode: "manual", text: "输入槽位定义完整" },
    depends_on: [],
    target_kind: "input_slot_definition",
    target_ref: "当前文件",
    acceptance_rule_text: "输入槽位定义完整，来源覆盖所有必填字段",
    ...overrides,
  };
}

describe("studio command protocol", () => {
  it("turns fix tasks into typed commands that forbid natural-language routes", () => {
    const command = buildFixTaskStudioCommand(makeTask());

    expect(command).toMatchObject({
      type: "fix_task",
      taskId: "fix-input-slots",
      targetKind: "input_slot_definition",
      requiredOutput: "studio_diff",
      forbiddenRoutes: ["binding_action", "test_flow"],
    });
    expect(command.content).toContain("这是 input_slot_definition 修复任务");
    expect(command.fallbackDiff?.ops?.[0]?.type).toBe("append");
  });

  it("keeps metadata description fixes on governance action output", () => {
    const command = buildFixTaskStudioCommand(makeTask({
      title: "描述不够清晰",
      description: "Skill 描述没有说明适用场景",
      acceptance_rule_text: "description 能说明适用对象和输出价值",
      target_kind: "skill_metadata",
      target_ref: "description",
      suggested_changes: "将 description 替换为：> 面向商务团队的客户复盘助手",
    }));

    expect(command.requiredOutput).toBe("studio_governance_action");
    expect(command.content).toContain("```studio_governance_action");
  });

  it("runs natural-language resolvers only for user input without a command", () => {
    expect(shouldRunNaturalLanguageResolvers({
      text: "请绑定候选人数据表",
      source: "user_input",
    })).toBe(true);

    const command = buildFixTaskStudioCommand(makeTask());
    expect(shouldRunNaturalLanguageResolvers({
      text: command.content,
      source: "system_command",
      command,
    })).toBe(false);

    expect(shouldRunNaturalLanguageResolvers({
      text: command.content,
      source: "user_input",
    })).toBe(false);
  });

  it("serializes command telemetry without duplicating prompt content", () => {
    const command = buildFixTaskStudioCommand(makeTask());

    expect(commandTelemetryPayload(command)).toEqual({
      type: "fix_task",
      task_id: "fix-input-slots",
      target_kind: "input_slot_definition",
      target_ref: "当前文件",
      target_files: [],
      required_output: "studio_diff",
      forbidden_routes: ["binding_action", "test_flow"],
    });
  });

  it("coerces natural-language fix-task replies into the local fallback studio_diff", () => {
    const command = buildFixTaskStudioCommand(makeTask());
    const coerced = coerceRequiredStructuredResponseText({
      text: "我来分析这个问题，确认后可以提供完整段落。",
      command,
      currentPrompt: "## 角色\n你是助手\n\n## 输出\n保持可行动。",
      final: true,
    });

    expect(coerced.trim().startsWith("```studio_diff")).toBe(true);
    expect(coerced).toContain("## 输入槽位定义");
    expect(coerced).not.toContain("我来分析这个问题");
  });

  it("replaces unsafe whole-prompt input-slot diffs with the fallback append diff", () => {
    const command = buildFixTaskStudioCommand(makeTask());
    const currentPrompt = `${"现有说明\n".repeat(40)}## 输出要求\n保持完整。`;
    const selected = selectStudioDiffForCommand({
      command,
      currentPrompt,
      diff: {
        ops: [{
          type: "replace",
          old: currentPrompt,
          new: "## 输入槽位定义\n只有很短的一段",
        }],
        change_note: "错误整文件替换",
      },
    });

    expect(selected?.change_note).toBe("补齐输入槽位定义和最小可执行分析输出");
    expect(selected?.ops?.[0]?.type).toBe("append");
  });
});
