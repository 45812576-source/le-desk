export const SKILL_STATUS_BADGE: Record<string, { color: "cyan" | "green" | "yellow" | "gray" | "red"; label: string }> = {
  draft: { color: "gray", label: "草稿" },
  reviewing: { color: "yellow", label: "审核中" },
  rejected: { color: "red", label: "已打回" },
  published: { color: "green", label: "已发布" },
  archived: { color: "red", label: "已归档" },
};

export function isEditableSkillStatus(status?: string | null): boolean {
  return status === "draft" || status === "reviewing" || status === "rejected";
}

export function isPublishedSkillStatus(status?: string | null): boolean {
  return status === "published";
}

export function isArchivedSkillStatus(status?: string | null): boolean {
  return status === "archived";
}

export function isVisibleInSkillStudio(status?: string | null): boolean {
  return isEditableSkillStatus(status) || isPublishedSkillStatus(status) || isArchivedSkillStatus(status);
}

export function isWorkspaceMountableSkillStatus(status?: string | null): boolean {
  return isPublishedSkillStatus(status);
}
