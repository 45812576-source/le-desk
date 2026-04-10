import { describe, expect, it } from "vitest";
import {
  isArchivedSkillStatus,
  isEditableSkillStatus,
  isPublishedSkillStatus,
  isVisibleInSkillStudio,
  isWorkspaceMountableSkillStatus,
} from "@/lib/skill-status";

describe("skill status helpers", () => {
  it("treats rejected skill as editable and visible in studio", () => {
    expect(isEditableSkillStatus("rejected")).toBe(true);
    expect(isVisibleInSkillStudio("rejected")).toBe(true);
  });

  it("limits workspace mountability to published skills", () => {
    expect(isWorkspaceMountableSkillStatus("published")).toBe(true);
    expect(isWorkspaceMountableSkillStatus("draft")).toBe(false);
    expect(isWorkspaceMountableSkillStatus("reviewing")).toBe(false);
    expect(isWorkspaceMountableSkillStatus("rejected")).toBe(false);
    expect(isWorkspaceMountableSkillStatus("archived")).toBe(false);
  });

  it("keeps published and archived predicates distinct", () => {
    expect(isPublishedSkillStatus("published")).toBe(true);
    expect(isPublishedSkillStatus("archived")).toBe(false);
    expect(isArchivedSkillStatus("archived")).toBe(true);
  });
});
