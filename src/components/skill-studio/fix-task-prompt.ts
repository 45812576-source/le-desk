import type { SkillMemoTask } from "@/lib/types";

type FixTaskWithSuggestedChanges = SkillMemoTask & {
  suggested_changes?: string | null;
};

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

export function buildDefaultFixTaskPrompt(task: SkillMemoTask): string {
  return `请帮我修复以下测试问题：\n${task.title}\n${task.description || ""}\n验收标准：${task.acceptance_rule_text || ""}`;
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
  return buildMetadataDescriptionFixPrompt(task) ?? buildDefaultFixTaskPrompt(task);
}
