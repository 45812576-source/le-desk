import { describe, expect, it } from "vitest";

import {
  buildDefaultFixTaskPrompt,
  buildFixTaskPrompt,
  buildInputSlotDefinitionFixPrompt,
  buildMetadataDescriptionFixPrompt,
  extractSuggestedDescription,
  isMetadataDescriptionFixTask,
  isStudioFixTaskPrompt,
} from "../fix-task-prompt";
import type { SkillMemoTask } from "@/lib/types";

function makeTask(overrides: Partial<SkillMemoTask> = {}): SkillMemoTask {
  return {
    id: "task-1",
    title: "描述不够清晰",
    type: "fix",
    status: "todo",
    priority: "high",
    description: "Skill 描述没有说明适用场景",
    target_files: [],
    acceptance_rule: { mode: "manual", text: "描述清晰" },
    depends_on: [],
    target_kind: "skill_metadata",
    target_ref: "description",
    acceptance_rule_text: "description 能说明适用对象和输出价值",
    suggested_changes: "将 description 替换为：> 面向商务团队的客户复盘助手，帮助识别续费和增购机会。",
    ...overrides,
  };
}

describe("fix task prompt helpers", () => {
  it("extracts suggested description from replacement text", () => {
    expect(extractSuggestedDescription("将 description 替换为：> 面向商务团队的客户复盘助手")).toBe("面向商务团队的客户复盘助手");
  });

  it("detects metadata description fix tasks", () => {
    expect(isMetadataDescriptionFixTask(makeTask())).toBe(true);
    expect(isMetadataDescriptionFixTask(makeTask({ target_kind: "skill_prompt" }))).toBe(false);
  });

  it("builds a governance action template for metadata description fixes", () => {
    const prompt = buildMetadataDescriptionFixPrompt(makeTask());

    expect(prompt).toContain("```studio_governance_action");
    expect(prompt).toContain('"target": "skill_metadata.description"');
    expect(prompt).toContain('"old": "description"');
    expect(prompt).toContain('"new": "面向商务团队的客户复盘助手，帮助识别续费和增购机会。"');
    expect(prompt).toContain("不要输出 studio_diff");
  });

  it("falls back to the default fix prompt when suggested description is missing", () => {
    const task = makeTask({ suggested_changes: "优化描述，但没有给具体文本" });

    expect(buildFixTaskPrompt(task)).toBe(buildDefaultFixTaskPrompt(task));
  });

  it("default prompt requires a structured diff for file fixes", () => {
    const prompt = buildDefaultFixTaskPrompt(makeTask({
      target_kind: "skill_prompt",
      target_ref: "SKILL.md",
      target_files: ["SKILL.md"],
      suggested_changes: undefined,
    }));

    expect(prompt).toContain("```studio_diff");
    expect(prompt).toContain("必须输出一个可解析的 studio_diff");
    expect(prompt).toContain("如果无法立即完成深度分析");
  });

  it("detects generated fix prompts so chat routing can bypass binding and test-flow interception", () => {
    const prompt = buildDefaultFixTaskPrompt(makeTask({
      target_kind: "input_slot_definition",
      target_ref: "当前文件",
      title: "修复输入槽位",
      description: "需要绑定知识库/数据表来源",
    }));

    expect(isStudioFixTaskPrompt(prompt)).toBe(true);
    expect(isStudioFixTaskPrompt("请绑定候选人数据表")).toBe(false);
  });

  it("builds a strict input slot diff prompt instead of a binding action prompt", () => {
    const task = makeTask({
      target_kind: "input_slot_definition",
      target_ref: "当前文件",
      title: "修复: [actionability] 输出缺少可执行成果",
      acceptance_rule_text: "输入槽位定义完整，来源覆盖所有必填字段",
    });
    const prompt = buildInputSlotDefinitionFixPrompt(task);

    expect(prompt).toContain("这是 input_slot_definition 修复任务");
    expect(prompt).toContain("不要输出 studio_governance_action");
    expect(prompt).toContain("knowledge_entry_id/evidence_ref");
    expect(prompt).toContain("table_name/field_name");
    expect(prompt).toContain("```studio_diff");
    expect(buildFixTaskPrompt(task)).toBe(prompt);
  });
});
