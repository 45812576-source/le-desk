import type { SkillMemoTask } from "@/lib/types";

type FixTaskWithSuggestedChanges = SkillMemoTask & {
  suggested_changes?: string | null;
};

export function isStudioFixTaskPrompt(value: string): boolean {
  const text = value.trim();
  if (!text) return false;
  if (/^请帮我修复以下(?:\s+Skill metadata)?\s*测试问题。/.test(text)) return true;
  return (
    text.includes("当前任务：")
    && text.includes("输出要求：")
    && (text.includes("studio_diff") || text.includes("studio_governance_action"))
  );
}

function cleanSuggestedDescription(value: string): string {
  const cleaned = value
    .replace(/^```[a-zA-Z]*\s*/g, "")
    .replace(/```$/g, "")
    .split("\n")
    .map((line) => line.replace(/^\s*(?:>\s*)?[-*]?\s*/, "").trimEnd())
    .join("\n")
    .trim();
  return cleaned.replace(/^["'“”‘’`]+|["'“”‘’`]+$/g, "").trim();
}

function trimTrailingInstructionLines(value: string): string {
  const lines = value.split("\n");
  const kept: string[] = [];
  for (const line of lines) {
    if (/^\s*(?:验收|验收标准|acceptance|retest|复测|目标|原因|证据)\s*[:：]/i.test(line)) {
      break;
    }
    kept.push(line);
  }
  return kept.join("\n");
}

export function extractSuggestedDescription(suggestedChanges?: string | null): string | null {
  if (!suggestedChanges?.trim()) return null;
  const text = suggestedChanges.trim();
  const replacementMatch = text.match(
    /(?:将\s*)?(?:skill\s*)?description\s*(?:字段)?\s*(?:替换为|改为|更新为|设置为|replace with)\s*[:：]\s*([\s\S]+)/i,
  );
  if (replacementMatch?.[1]) {
    const candidate = cleanSuggestedDescription(trimTrailingInstructionLines(replacementMatch[1]));
    return candidate || null;
  }

  const quotedMatch = text.match(/[“"]([^“”"]{8,})[”"]/) || text.match(/`([^`]{8,})`/);
  if (quotedMatch?.[1]) {
    const candidate = cleanSuggestedDescription(quotedMatch[1]);
    return candidate || null;
  }

  const blockquote = text
    .split("\n")
    .filter((line) => /^\s*>/.test(line))
    .map((line) => line.replace(/^\s*>\s?/, ""))
    .join("\n");
  if (blockquote.trim()) {
    const candidate = cleanSuggestedDescription(blockquote);
    return candidate || null;
  }

  return null;
}

export function isMetadataDescriptionFixTask(task: FixTaskWithSuggestedChanges): boolean {
  const targetKind = (task.target_kind || "").toLowerCase();
  const targetRef = (task.target_ref || task.target_files?.join(" ") || "").toLowerCase();
  const suggestedChanges = (task.suggested_changes || "").toLowerCase();
  const combined = `${targetRef}\n${suggestedChanges}\n${task.description || ""}`.toLowerCase();
  return targetKind === "skill_metadata" && /description|描述/.test(combined);
}

function isInputSlotDefinitionFixTask(task: FixTaskWithSuggestedChanges): boolean {
  const targetKind = (task.target_kind || "").toLowerCase();
  const targetRef = `${task.target_ref || ""} ${(task.target_files || []).join(" ")}`.toLowerCase();
  const combined = `${targetRef}\n${task.title || ""}\n${task.description || ""}\n${task.acceptance_rule_text || ""}\n${task.suggested_changes || ""}`.toLowerCase();
  return targetKind === "input_slot_definition" || /input[_\s-]*slot|输入槽位|槽位定义/.test(combined);
}

export function buildDefaultFixTaskPrompt(task: SkillMemoTask): string {
  const targetFiles = task.target_files?.length ? task.target_files.join("、") : (task.target_ref || "当前文件");
  return [
    "请帮我修复以下测试问题。",
    "",
    `当前任务：${task.title}`,
    task.description ? `失败主因：${task.description}` : null,
    `目标文件：${targetFiles}`,
    task.target_kind ? `目标类型：${task.target_kind}` : null,
    task.acceptance_rule_text ? `验收标准：${task.acceptance_rule_text}` : null,
    task.suggested_changes ? `整改建议：${task.suggested_changes}` : null,
    "",
    "输出要求：",
    "1. 如果能修改 SKILL.md 或 source file，必须输出一个可解析的 studio_diff 结构化块，不要只给自然语言方案。",
    "2. studio_diff 必须包含 ops 数组和 change_note；ops 使用 replace/insert_after/insert_before/append/delete 之一，并尽量使用当前文件中的原文作为 old 或 anchor。",
    "3. 如果问题是 Skill 元数据 description，请输出 studio_governance_action，target 固定为 skill_metadata.description，并在 staged_edit.ops 中给出 old=description、new=新的 description。",
    "4. 如果无法立即完成深度分析，也必须先给出最小可执行修复：明确改哪一段、加入哪几条检查项、保存后如何验收；不要只承诺后续会分析。",
    "5. 普通解释可以很短，但结构化块必须放在回复末尾。",
    "",
    "studio_diff 示例：",
    "```studio_diff",
    JSON.stringify({
      ops: [
        {
          type: "insert_after",
          anchor: "## 输出要求",
          content: "\n- 当无法执行深度分析时，先给出 3 步最小分析框架、需要绑定的知识库/数据表清单，以及用户下一步可操作事项。",
        },
      ],
      change_note: "补齐无法深度分析时的即时行动指导",
    }, null, 2),
    "```",
  ].filter((line): line is string => line !== null).join("\n");
}

export function buildInputSlotDefinitionFixPrompt(task: FixTaskWithSuggestedChanges): string {
  const targetFiles = task.target_files?.length ? task.target_files.join("、") : (task.target_ref || "当前文件");
  const payload = {
    ops: [
      {
        type: "append",
        content: [
          "",
          "## 输入槽位定义",
          "- `analysis_request`：用户要执行的分析任务；required=true；structured=false；allowed_sources=[\"chat_text\"]；chosen_source=\"chat_text\"；evidence_status=\"verified\"；chat_example=\"请分析……\"。",
          "- `analysis_materials`：分析所需资料；required=true；structured=true；allowed_sources=[\"knowledge\", \"data_table\", \"chat_text\"]；当选择 knowledge 时填写 knowledge_entry_id/evidence_ref，当选择 data_table 时填写 table_name/field_name，当无法绑定外部源时用 chat_text 提供最小样例。",
          "- `output_acceptance`：验收口径；required=true；structured=true；allowed_sources=[\"chat_text\", \"system_runtime\"]；至少包含输出格式、必填字段、通过标准。",
          "",
          "### 无法立即深度分析时的最小可执行输出",
          "1. 先交付 3 步分析框架：问题拆解、资料核验、输出模板。",
          "2. 列出需要绑定或补充的知识库/数据表字段清单，并标明每项缺失时的 chat_text 替代输入。",
          "3. 给出用户下一步可直接执行的操作：补充哪段材料、选择哪个来源、保存后如何复测。",
        ].join("\n"),
      },
    ],
    change_note: "补齐输入槽位定义和最小可执行分析输出",
  };

  return [
    "请帮我修复以下测试问题。",
    "",
    `当前任务：${task.title}`,
    task.description ? `失败主因：${task.description}` : null,
    `目标文件：${targetFiles}`,
    task.target_kind ? `目标类型：${task.target_kind}` : "目标类型：input_slot_definition",
    task.acceptance_rule_text ? `验收标准：${task.acceptance_rule_text}` : null,
    task.suggested_changes ? `整改建议：${task.suggested_changes}` : null,
    "",
    "这是 input_slot_definition 修复任务，不是知识库、数据表或工具绑定任务。",
    "",
    "必须立即交付：",
    "1. 只输出可采纳的 studio_diff 结构化块；不要输出 studio_governance_action、studio_tool_suggestion 或任何绑定动作。",
    "2. 在当前文件中补齐输入槽位定义；每个必填槽位都要覆盖 slot_key、label、structured、required、allowed_sources、chosen_source、evidence_status、evidence_ref、chat_example、knowledge_entry_id、table_name、field_name。",
    "3. 来源覆盖所有必填字段：knowledge 来源必须说明 knowledge_entry_id/evidence_ref；data_table 来源必须说明 table_name/field_name；chat_text 来源必须提供 chat_example；system_runtime 来源必须说明 evidence_ref。",
    "4. 当无法立即执行深度分析时，也要在本次回复交付最小可执行分析框架、待绑定/待补充来源清单、用户下一步操作和保存后复测方式。",
    "5. studio_diff 必须包含 ops 数组和 change_note；ops 使用 replace/insert_after/insert_before/append/delete 之一，并尽量使用当前文件中的原文作为 old 或 anchor。找不到稳定 anchor 时使用 append。",
    "",
    "studio_diff 最小可执行示例：",
    "```studio_diff",
    JSON.stringify(payload, null, 2),
    "```",
  ].filter((line): line is string => line !== null).join("\n");
}

export function buildMetadataDescriptionFixPrompt(task: FixTaskWithSuggestedChanges): string | null {
  if (!isMetadataDescriptionFixTask(task)) return null;
  const suggestedDescription = extractSuggestedDescription(task.suggested_changes);
  if (!suggestedDescription) return null;
  const cardId = `metadata-description-${task.id}`;
  const payload = {
    card_id: cardId,
    title: "更新 Skill 描述",
    summary: "将 Skill description 更新为整改计划中已明确给出的描述文本。",
    target: "skill_metadata.description",
    reason: task.description || task.title,
    risk_level: "low",
    staged_edit: {
      ops: [
        {
          type: "replace",
          old: "description",
          new: suggestedDescription,
        },
      ],
    },
  };

  return [
    "请帮我修复以下 Skill metadata 测试问题。",
    "",
    `当前任务：${task.title}`,
    task.description ? `失败主因：${task.description}` : null,
    task.acceptance_rule_text ? `验收标准：${task.acceptance_rule_text}` : null,
    "",
    "整改计划 suggested_changes 已给出明确的 Skill description 目标值：",
    suggestedDescription,
    "",
    "行为指引：",
    "1. 先用一句话复述失败主因，确认这是 description 元数据修复。",
    "2. 这类任务允许并要求输出 studio_governance_action 结构化块，不要只给任务建议。",
    "3. 不要改写 SKILL.md 正文，不要输出 studio_diff；只修改 metadata.description。",
    "4. 直接使用下面的结构化块模板，保持 JSON 可解析。",
    "",
    "```studio_governance_action",
    JSON.stringify(payload, null, 2),
    "```",
  ].filter((line): line is string => line !== null).join("\n");
}

export function buildFixTaskPrompt(task: FixTaskWithSuggestedChanges): string {
  if (isInputSlotDefinitionFixTask(task)) return buildInputSlotDefinitionFixPrompt(task);
  return buildMetadataDescriptionFixPrompt(task) ?? buildDefaultFixTaskPrompt(task);
}
