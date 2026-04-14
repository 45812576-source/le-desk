import { describe, expect, it } from "vitest";
import type { SkillDetail } from "@/lib/types";
import { buildOwnWorkspaceSkillItems } from "@/lib/workspace-skill-config";

describe("buildOwnWorkspaceSkillItems", () => {
  it("keeps own draft skills visible but not mountable", () => {
    const skills: SkillDetail[] = [
      {
        id: 1,
        name: "草稿 Skill",
        description: "draft",
        status: "draft",
        scope: "personal",
        created_by: 1,
        department_id: null,
        is_active: true,
        created_at: "2026-04-14T00:00:00Z",
        current_version: 0,
        mode: "chat",
        knowledge_tags: [],
        auto_inject: false,
      },
    ];
    const items = buildOwnWorkspaceSkillItems(
      skills,
      new Map(),
    );

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: 1,
      mounted: false,
      mountable: false,
      status: "draft",
    });
  });

  it("keeps published skills mountable and preserves mount state", () => {
    const skills: SkillDetail[] = [
      {
        id: 2,
        name: "已发布 Skill",
        description: "published",
        status: "published",
        scope: "personal",
        created_by: 1,
        department_id: null,
        is_active: true,
        created_at: "2026-04-14T00:00:00Z",
        current_version: 1,
        mode: "chat",
        knowledge_tags: [],
        auto_inject: false,
      },
    ];
    const items = buildOwnWorkspaceSkillItems(
      skills,
      new Map([[2, { mounted: true }]]),
    );

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: 2,
      mounted: true,
      mountable: true,
      status: "published",
    });
  });
});
