import type { SkillDetail } from "@/lib/types";

export interface WorkspaceSkillListItem {
  id: number;
  name: string;
  description?: string;
  status?: string;
  approval_stage?: string | null;
  scope?: string;
  source: "own";
  mounted: boolean;
  mountable: boolean;
}

export function buildOwnWorkspaceSkillItems(
  mySkills: SkillDetail[],
  mountedSkills: Map<number, { mounted: boolean }>,
): WorkspaceSkillListItem[] {
  return mySkills.map((skill) => ({
    id: skill.id,
    name: skill.name,
    description: skill.description,
    status: skill.status,
    approval_stage: skill.approval_stage,
    scope: skill.scope,
    source: "own",
    mounted: mountedSkills.get(skill.id)?.mounted ?? false,
    mountable: skill.status === "published",
  }));
}
