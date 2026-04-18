import type { TestFlowSkillCandidate } from "@/lib/test-flow-types";

const GENERATE_CASE_INTENT_PATTERN = /(生成|产出|输出|给我|帮我).{0,12}(测试用例|测试集|case|cases)/i;

export function hasGenerateCaseIntent(content: string): boolean {
  return GENERATE_CASE_INTENT_PATTERN.test(content);
}

export function findMentionedSkillIds(
  content: string,
  skills: Array<Pick<TestFlowSkillCandidate, "id" | "name">>,
): number[] {
  if (!content.trim()) return [];
  const matched = skills.filter((skill) => content.includes(`@${skill.name}`));
  return Array.from(new Set(matched.map((skill) => skill.id)));
}
